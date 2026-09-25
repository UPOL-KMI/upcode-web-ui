"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import type { ConfigValues } from "@/lib/actions/exercise-config.schema";
import type { FileEntry } from "@/lib/exercise-config/simple-config";
import { buttonClasses } from "@/components/button";

/**
 * The four repeated shapes of the per-test configuration form (T-009): a list of strings, a list
 * of the exercise's own files, a list of files each with the name it takes inside the sandbox, and
 * one such file on its own.
 *
 * All four are edited through `watch`/`setValue` rather than `useFieldArray`, which cannot key a
 * list of bare strings -- and mixing the two styles across one form is worse than picking the one
 * that covers every case here.
 *
 * **Every one of these has to survive a narrow column.** They are laid out in a grid, and a grid
 * track will not shrink below its content unless it is told to -- so each root carries `min-w-0`
 * and each row wraps rather than compressing its controls. Without that, a row of select + name +
 * remove spilled out of its column and landed on top of the neighbouring one, which is how the
 * operator found this.
 *
 * **A file is chosen, never typed.** Every one of these values is a `remote-file`, which core-api
 * resolves against the exercise's own attached files; a typo becomes an evaluation that fails at
 * run time with nothing to point at. Uploading those files is T-023's, so an exercise with none
 * gets a select with nothing in it and a line saying where they come from.
 */
const INPUT =
  "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

type Path = string;

function useValue<T>(name: Path): [T, (value: T) => void] {
  const { watch, setValue } = useFormContext<ConfigValues>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- paths here are built from ids
  const value = watch(name as any) as T;
  const set = (next: T) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
    setValue(name as any, next as any, { shouldDirty: true });
  return [value, set];
}

export function FileSelect({
  name,
  label,
  files,
  readOnly,
  description,
  error,
  warning,
}: {
  name: Path;
  label: string;
  files: string[];
  readOnly: boolean;
  description?: string;
  /** Shown under the control and marked on it, for a value core-api will refuse to compile. */
  error?: string;
  /**
   * Shown under the control for a value that is **legal and probably a mistake** (X-024).
   *
   * Deliberately not `error`: it carries no `aria-invalid`, because the value is one core-api
   * will accept and a screen reader announcing it as invalid would be lying. The author is being
   * told something, not stopped.
   */
  warning?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<string>(name);
  const descriptionId = `${name}-description`;
  const errorId = `${name}-error`;
  const warningId = `${name}-warning`;

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        aria-invalid={error ? true : undefined}
        className={
          error ? `${INPUT} border-destructive` : warning ? `${INPUT} border-warning` : INPUT
        }
        // The visible label wraps this control, and a wrapped `<select>` takes its whole label --
        // including every option's text -- as its accessible name. Naming it explicitly is what
        // makes a screen reader (and a test) hear "Expected output" rather than the option list.
        aria-label={label}
        aria-describedby={
          [description ? descriptionId : null, error ? errorId : null, warning ? warningId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        disabled={readOnly}
        value={value ?? ""}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">{t("noFile")}</option>
        {/* A file named in the configuration but no longer attached still has to be selectable,
            or opening the form and saving it would silently drop the reference. */}
        {(files.includes(value) || !value ? files : [value, ...files]).map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </span>
      )}
      {!error && warning && (
        <span id={warningId} className="text-xs font-medium text-warning">
          {warning}
        </span>
      )}
      {description && (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      )}
    </label>
  );
}

export function StringListField({
  name,
  label,
  readOnly,
  description,
  placeholder,
}: {
  name: Path;
  label: string;
  readOnly: boolean;
  description?: string;
  placeholder?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<string[]>(name);
  const items = value ?? [];
  const descriptionId = `${name}-description`;

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {items.map((item, index) => (
        <span key={index} className="flex flex-wrap items-center gap-1">
          <input
            type="text"
            className={`${INPUT} min-w-0 flex-1 font-mono`}
            aria-label={`${label} ${index + 1}`}
            aria-describedby={description ? descriptionId : undefined}
            placeholder={placeholder}
            disabled={readOnly}
            value={item}
            onChange={(event) =>
              setValue(items.map((entry, at) => (at === index ? event.target.value : entry)))
            }
          />
          {!readOnly && (
            <button
              type="button"
              aria-label={t("removeItem")}
              onClick={() => setValue(items.filter((_, at) => at !== index))}
              className={buttonClasses("outline", "xs")}
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setValue([...items, ""])}
          className={buttonClasses("outline", "xs", "self-start")}
        >
          {t("addItem")}
        </button>
      )}
      {description && (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  );
}

export function FileListField({
  name,
  label,
  files,
  readOnly,
  description,
}: {
  name: Path;
  label: string;
  files: string[];
  readOnly: boolean;
  description?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<string[]>(name);
  const items = value ?? [];
  const descriptionId = `${name}-description`;

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {items.map((item, index) => (
        <span key={index} className="flex flex-wrap items-center gap-1">
          <select
            className={`${INPUT} min-w-0 flex-1`}
            aria-label={`${label} ${index + 1}`}
            aria-describedby={description ? descriptionId : undefined}
            disabled={readOnly}
            value={item}
            onChange={(event) =>
              setValue(items.map((entry, at) => (at === index ? event.target.value : entry)))
            }
          >
            <option value="">{t("noFile")}</option>
            {(files.includes(item) || !item ? files : [item, ...files]).map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
          {!readOnly && (
            <button
              type="button"
              aria-label={t("removeItem")}
              onClick={() => setValue(items.filter((_, at) => at !== index))}
              className={buttonClasses("outline", "xs")}
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setValue([...items, ""])}
          className={buttonClasses("outline", "xs", "self-start")}
        >
          {t("addItem")}
        </button>
      )}
      {description && (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  );
}

export function FilePairListField({
  name,
  label,
  files,
  readOnly,
  description,
}: {
  name: Path;
  label: string;
  files: string[];
  readOnly: boolean;
  description?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<FileEntry[]>(name);
  const items = value ?? [];
  const descriptionId = `${name}-description`;

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {items.map((item, index) => (
        <span key={index} className="flex flex-wrap items-center gap-1">
          <select
            className={`${INPUT} min-w-0 flex-1 basis-40`}
            aria-label={`${label} ${index + 1}`}
            aria-describedby={description ? descriptionId : undefined}
            disabled={readOnly}
            value={item.file}
            onChange={(event) =>
              setValue(
                items.map((entry, at) =>
                  at === index ? { ...entry, file: event.target.value } : entry,
                ),
              )
            }
          >
            <option value="">{t("noFile")}</option>
            {(files.includes(item.file) || !item.file ? files : [item.file, ...files]).map(
              (file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ),
            )}
          </select>
          <input
            type="text"
            className={`${INPUT} min-w-0 flex-1 basis-32 font-mono`}
            aria-label={t("renamedTo", { label, index: index + 1 })}
            aria-describedby={description ? descriptionId : undefined}
            placeholder={t("sameName")}
            disabled={readOnly}
            value={item.name}
            onChange={(event) =>
              setValue(
                items.map((entry, at) =>
                  at === index ? { ...entry, name: event.target.value } : entry,
                ),
              )
            }
          />
          {!readOnly && (
            <button
              type="button"
              aria-label={t("removeItem")}
              onClick={() => setValue(items.filter((_, at) => at !== index))}
              className={buttonClasses("outline", "xs")}
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setValue([...items, { file: "", name: "" }])}
          className={buttonClasses("outline", "xs", "self-start")}
        >
          {t("addItem")}
        </button>
      )}
      {description && (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  );
}
