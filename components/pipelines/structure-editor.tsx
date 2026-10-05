"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { updatePipelineStructure } from "@/lib/actions/pipeline";
import { layoutPipeline } from "@/lib/pipelines/layout";
import {
  parsePipelineStructure,
  serializePipelineStructure,
  type ParseFailure,
} from "@/lib/pipelines/structure-file";
import { renderPipelineSvg } from "@/lib/pipelines/svg";
import {
  isArrayType,
  ports,
  utilization,
  VARIABLE_TYPES,
  type BoxType,
  type PipelineBox,
  type PipelineStructure,
  type PipelineVariable,
} from "@/lib/pipelines/types";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";
import { DownloadIcon } from "@/components/icons";

/**
 * Editing a pipeline's boxes and variables (T-016).
 *
 * **The picture updates as you edit, and it is the same code that draws it on the read-only
 * screen.** `layoutPipeline` and `renderPipelineSvg` are pure functions with no dependencies, so
 * the server renders them for a reader and this component renders them for an author -- one
 * implementation, no WebAssembly, and the preview is the thing that makes a wiring mistake visible
 * before it is saved (DEC-107).
 *
 * **A port is wired by choosing a variable, never by typing a name.** That is the single most
 * useful thing this screen does: a pipeline connects boxes by *name matching*, so a typo does not
 * fail -- it silently produces an unconnected port and a variable nothing reads, which core-api
 * accepts and the evaluation then does something inexplicable with. The select is filtered to
 * variables of the port's own data type.
 *
 * **Two of core-api's rules are about the graph and are checked here**, both learned by saving a
 * structure that broke them: a variable may be written by at most one port, and must be read by at
 * least one. Neither is a property of a field, so neither could be a field's validation; both
 * block the save, because a red banner after the fact says less than a marked list before it.
 *
 * The whole structure is saved at once with `version` as the optimistic lock, because that is what
 * core-api's endpoint takes: there is no call that adds one box.
 */
export function StructureEditor({
  pipelineId,
  version,
  structure,
  boxTypes,
  readOnly,
}: {
  pipelineId: string;
  version: number;
  structure: PipelineStructure;
  boxTypes: BoxType[];
  readOnly: boolean;
}) {
  const t = useTranslations("PipelineEdit.structure");
  const router = useRouter();
  const toast = useToast();

  const [boxes, setBoxes] = useState<PipelineBox[]>(() =>
    (structure.boxes ?? []).map((box) => ({
      ...box,
      portsIn: { ...ports(box.portsIn) },
      portsOut: { ...ports(box.portsOut) },
    })),
  );
  const [variables, setVariables] = useState<PipelineVariable[]>(() => structure.variables ?? []);
  const [newBoxType, setNewBoxType] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<{ name: string; structure: PipelineStructure } | null>(
    null,
  );

  const used = useMemo(() => utilization(boxes), [boxes]);
  const svg = useMemo(
    () => renderPipelineSvg(layoutPipeline(boxes, variables), { title: t("preview") }),
    [boxes, variables, t],
  );

  /**
   * The two rules core-api enforces on the *graph* rather than on any one field, both found by
   * saving a structure that broke them rather than from documentation:
   *
   * - a variable may be written by **at most one** port ("Multiple ports output variable ...");
   * - a variable must be read by **at least one** ("No port uses variable ...") -- a value written
   *   and never consumed is refused, and so is one nothing touches at all.
   *
   * A variable that is only *read* is fine and is the normal case: that is exactly what an
   * external reference is, a hole the exercise fills in. Both block the save, because core-api
   * would refuse it and a red banner after the fact says less than a marked list before it.
   */
  const broken = useMemo(() => {
    const writtenTwice = Object.entries(used)
      .filter(([, entry]) => entry.portsOut.length > 1)
      .map(([name, entry]) => ({
        name,
        by: entry.portsOut.map((port) => `${port.box}.${port.port}`),
      }));
    const unread = variables
      .filter((variable) => (used[variable.name]?.portsIn.length ?? 0) === 0)
      .map((variable) => variable.name);
    return { writtenTwice, unread };
  }, [variables, used]);

  /** Advice rather than a rule: core-api stores an unwired port happily. */
  const dangling = useMemo(
    () =>
      boxes.flatMap((box) =>
        [...Object.entries(ports(box.portsIn)), ...Object.entries(ports(box.portsOut))]
          .filter(([, port]) => !port.value)
          .map(([name]) => `${box.name}.${name}`),
      ),
    [boxes],
  );

  function setBox(index: number, next: Partial<PipelineBox>) {
    setBoxes((previous) => previous.map((box, at) => (at === index ? { ...box, ...next } : box)));
  }

  function setPort(index: number, side: "portsIn" | "portsOut", port: string, value: string) {
    setBoxes((previous) =>
      previous.map((box, at) =>
        at === index
          ? {
              ...box,
              [side]: {
                ...ports(box[side]),
                [port]: { ...ports(box[side])[port]!, value },
              },
            }
          : box,
      ),
    );
  }

  function addBox() {
    const type = boxTypes.find((entry) => entry.type === newBoxType);
    if (!type) return;
    const taken = new Set(boxes.map((box) => box.name));
    let name = type.type;
    for (let counter = 2; taken.has(name); counter++) name = `${type.type}-${counter}`;
    setBoxes((previous) => [
      ...previous,
      {
        name,
        type: type.type,
        portsIn: Object.fromEntries(
          Object.entries(ports(type.portsIn)).map(([port, definition]) => [
            port,
            { type: definition.type, value: "" },
          ]),
        ),
        portsOut: Object.fromEntries(
          Object.entries(ports(type.portsOut)).map(([port, definition]) => [
            port,
            { type: definition.type, value: "" },
          ]),
        ),
      },
    ]);
  }

  function addVariable() {
    const taken = new Set(variables.map((variable) => variable.name));
    let name = "variable";
    for (let counter = 2; taken.has(name); counter++) name = `variable-${counter}`;
    setVariables((previous) => [...previous, { name, type: "file", value: "" }]);
  }

  /** Renaming a variable rewires every port that named it -- otherwise the rename disconnects. */
  function renameVariable(index: number, next: string) {
    const previousName = variables[index]!.name;
    setVariables((current) =>
      current.map((variable, at) => (at === index ? { ...variable, name: next } : variable)),
    );
    setBoxes((current) =>
      current.map((box) => {
        const rewire = (side: Record<string, { type: string; value: string }>) =>
          Object.fromEntries(
            Object.entries(side).map(([port, definition]) => [
              port,
              definition.value === previousName ? { ...definition, value: next } : definition,
            ]),
          );
        return {
          ...box,
          portsIn: rewire(ports(box.portsIn)),
          portsOut: rewire(ports(box.portsOut)),
        };
      }),
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await updatePipelineStructure(pipelineId, {
      version,
      boxes: boxes.map((box) => ({
        name: box.name.trim(),
        type: box.type,
        portsIn: ports(box.portsIn),
        portsOut: ports(box.portsOut),
      })),
      variables: variables.map((variable) => ({ ...variable, name: variable.name.trim() })),
    });
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    router.refresh();
  }

  /**
   * G-017. **Client-side, unlike every other file this app hands over** (T-007's points export and
   * G-015's pipeline files both go through a Route Handler so they need no JavaScript). The reason
   * is not preference: what is exported is the editor's *current* state, including edits that have
   * not been saved, and the server does not have it. That is legacy's behaviour too, and it is the
   * useful one -- exporting work in progress is most of why somebody wants a file.
   */
  function exportStructure() {
    const text = serializePipelineStructure({ boxes, variables });
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pipeline.json";
    link.click();
    // Revoked, or the blob is held for the life of the document -- a structure is not large, but
    // an editor session can export many times.
    URL.revokeObjectURL(url);
  }

  /**
   * Reading a file replaces everything in the editor, so it **asks first**. Legacy pushed the old
   * contents onto its undo stack instead; this screen has no undo (deliberately out of G-017's
   * scope), so a confirmation is what stands in for it -- otherwise one wrong file silently
   * discards an afternoon's wiring.
   *
   * Nothing is saved by importing. The structure lands in the editor, the graph redraws, and the
   * save button does what it always does -- which also means core-api's own validation still gets
   * the last word on a file that parsed but describes a broken pipeline.
   */
  async function readFile(file: File) {
    setError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError(t("import.unreadable", { name: file.name }));
      return;
    }
    const result = parsePipelineStructure(text);
    if (!result.ok) {
      setError(
        t(`import.reasons.${result.reason}` satisfies `import.reasons.${ParseFailure}`, {
          name: file.name,
        }),
      );
      return;
    }
    setImporting({ name: file.name, structure: result.structure });
  }

  function applyImport(structure: PipelineStructure) {
    setBoxes(
      structure.boxes.map((box) => ({
        ...box,
        portsIn: { ...ports(box.portsIn) },
        portsOut: { ...ports(box.portsOut) },
      })),
    );
    setVariables(structure.variables);
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";
  const small = `${input} text-xs`;

  return (
    <div className="flex flex-col gap-6">
      <div tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-3">
        <div className="text-foreground" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      <section aria-labelledby="pipeline-variables-editor" className="flex flex-col gap-2">
        <div>
          <h3 id="pipeline-variables-editor" className="text-sm font-semibold">
            {t("variables")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("variablesExplain")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">
                  {t("variable.name")}
                </th>
                <th scope="col" className="py-1 pr-2 font-medium">
                  {t("variable.type")}
                </th>
                <th scope="col" className="py-1 pr-2 font-medium">
                  {t("variable.value")}
                </th>
                {!readOnly && <th scope="col" className="py-1" />}
              </tr>
            </thead>
            <tbody>
              {variables.map((variable, index) => (
                <tr key={index} className="border-b border-border/50">
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      className={`${small} w-44 font-mono`}
                      aria-label={t("variable.nameOf", { index: index + 1 })}
                      disabled={readOnly}
                      value={variable.name}
                      onChange={(event) => renameVariable(index, event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className={small}
                      aria-label={t("variable.typeOf", { name: variable.name })}
                      disabled={readOnly}
                      value={variable.type}
                      onChange={(event) =>
                        setVariables((previous) =>
                          previous.map((entry, at) =>
                            at === index
                              ? {
                                  ...entry,
                                  type: event.target.value,
                                  // The value has to change shape with the type, or core-api
                                  // refuses a string where it wants a list.
                                  value: isArrayType(event.target.value) ? [] : "",
                                }
                              : entry,
                          ),
                        )
                      }
                    >
                      {VARIABLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      className={`${small} w-56 font-mono`}
                      aria-label={t("variable.valueOf", { name: variable.name })}
                      placeholder={isArrayType(variable.type) ? t("variable.listHint") : ""}
                      disabled={readOnly}
                      value={
                        Array.isArray(variable.value) ? variable.value.join(", ") : variable.value
                      }
                      onChange={(event) =>
                        setVariables((previous) =>
                          previous.map((entry, at) =>
                            at === index
                              ? {
                                  ...entry,
                                  value: isArrayType(entry.type)
                                    ? event.target.value
                                        .split(",")
                                        .map((part) => part.trim())
                                        .filter(Boolean)
                                    : event.target.value,
                                }
                              : entry,
                          ),
                        )
                      }
                    />
                  </td>
                  {!readOnly && (
                    <td className="py-1 text-right">
                      <button
                        type="button"
                        aria-label={t("removeVariable", { index: index + 1 })}
                        onClick={() =>
                          setVariables((previous) => previous.filter((_, at) => at !== index))
                        }
                        className={buttonClasses("outline", "xs")}
                      >
                        {t("remove")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addVariable}
            className={buttonClasses("outline", "sm", "self-start")}
          >
            {t("addVariable")}
          </button>
        )}
      </section>

      <section aria-labelledby="pipeline-boxes-editor" className="flex flex-col gap-2">
        <div>
          <h3 id="pipeline-boxes-editor" className="text-sm font-semibold">
            {t("boxes")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("boxesExplain")}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {boxes.map((box, index) => (
            <li key={index} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t("box.name")}
                  <input
                    type="text"
                    className={`${input} w-52 font-mono`}
                    disabled={readOnly}
                    value={box.name}
                    onChange={(event) => setBox(index, { name: event.target.value })}
                  />
                </label>
                <p className="pb-1.5 text-xs text-muted-foreground">
                  {t("box.type")}: <code>{box.type}</code>
                </p>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={t("removeBox", { name: box.name })}
                    onClick={() => setBoxes((previous) => previous.filter((_, at) => at !== index))}
                    className={buttonClasses("outline", "xs", "ml-auto")}
                  >
                    {t("remove")}
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {(["portsIn", "portsOut"] as const).map((side) => {
                  const entries = Object.entries(ports(box[side]));
                  if (entries.length === 0) return null;
                  return (
                    <div key={side} className="flex flex-col gap-1">
                      <p className="text-xs font-medium">
                        {side === "portsIn" ? t("box.reads") : t("box.writes")}
                      </p>
                      {entries.map(([port, definition]) => (
                        <label key={port} className="flex items-center gap-2 text-xs">
                          <span className="w-32 shrink-0 truncate font-mono">{port}</span>
                          <span className="w-20 shrink-0 text-muted-foreground">
                            {definition.type}
                          </span>
                          <select
                            className={`${small} min-w-0 flex-1`}
                            aria-label={t("box.portOf", { box: box.name, port })}
                            disabled={readOnly}
                            value={definition.value}
                            onChange={(event) => setPort(index, side, port, event.target.value)}
                          >
                            <option value="">{t("box.unconnected")}</option>
                            {/* Only variables of the port's own type: a pipeline is wired by name
                                matching, so an unmatched name is not an error, it is a wire that
                                quietly is not there. */}
                            {variables
                              .filter((variable) => variable.type === definition.type)
                              .map((variable) => (
                                <option key={variable.name} value={variable.name}>
                                  {variable.name}
                                </option>
                              ))}
                            {definition.value &&
                              !variables.some((variable) => variable.name === definition.value) && (
                                <option value={definition.value}>
                                  {t("box.missingVariable", { name: definition.value })}
                                </option>
                              )}
                          </select>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        {!readOnly && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("box.addType")}
              <select
                className={input}
                aria-label={t("box.addType")}
                value={newBoxType}
                onChange={(event) => setNewBoxType(event.target.value)}
              >
                <option value="">{t("box.chooseType")}</option>
                {boxTypes.map((type) => (
                  <option key={type.type} value={type.type}>
                    {type.name} ({type.type})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!newBoxType}
              onClick={addBox}
              className={buttonClasses("outline", "sm")}
            >
              {t("addBox")}
            </button>
          </div>
        )}
      </section>

      {(broken.writtenTwice.length > 0 || broken.unread.length > 0) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm"
        >
          <p className="font-medium">{t("broken.title")}</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {broken.writtenTwice.map((entry) => (
              <li key={entry.name}>
                {t("broken.writtenTwice", { name: entry.name, ports: entry.by.join(", ") })}
              </li>
            ))}
            {broken.unread.length > 0 && (
              <li>{t("broken.unread", { variables: broken.unread.join(", ") })}</li>
            )}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">{t("broken.explain")}</p>
        </div>
      )}

      {dangling.length > 0 && (
        <div className="rounded-lg border border-warning bg-warning/10 p-3 text-sm">
          <p className="font-medium">{t("dangling.title")}</p>
          <p className="mt-1 text-xs">{t("dangling.ports", { ports: dangling.join(", ") })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("dangling.explain")}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* G-017. Export is offered to a reader who may only look: taking a copy of a definition
          away is not a change to it, and it is how a pipeline moves to another instance. Import
          is not -- it rewrites the editor, so it needs somewhere to save to. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button type="button" onClick={exportStructure} className={buttonClasses("outline", "sm")}>
          <DownloadIcon />
          {t("export.action")}
        </button>
        {!readOnly && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
              className={buttonClasses("outline", "sm")}
            >
              {t("import.action")}
            </button>
            {/* Hidden rather than styled, and reset after every pick so that choosing the same
                file twice fires `change` the second time as well. */}
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label={t("import.action")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void readFile(file);
              }}
            />
          </>
        )}
        <p className="text-xs text-muted-foreground">{t("export.note")}</p>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending || broken.writtenTwice.length > 0 || broken.unread.length > 0}
            onClick={() => void save()}
            className={buttonClasses("primary", "sm")}
          >
            {pending ? t("saving") : t("save")}
          </button>
          <p className="text-xs text-muted-foreground">{t("saveNote")}</p>
        </div>
      )}

      <ConfirmDialog
        open={importing !== null}
        onOpenChange={(open) => {
          if (!open) setImporting(null);
        }}
        title={t("import.confirm.title")}
        description={t("import.confirm.description", {
          name: importing?.name ?? "",
          boxes: importing?.structure.boxes.length ?? 0,
          variables: importing?.structure.variables.length ?? 0,
        })}
        confirmLabel={t("import.confirm.confirm")}
        onConfirm={() => {
          const pending = importing;
          setImporting(null);
          if (pending) applyImport(pending.structure);
        }}
      />
    </div>
  );
}
