import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getPipeline, getPipelineExercises } from "@/lib/api/pipelines";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { isExternalReference, ports, utilization } from "@/lib/pipelines/types";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";
import { PipelineGraph } from "@/components/pipelines/pipeline-graph";
import { Badge } from "@/components/status/badge";
import { buttonClasses } from "@/components/button";
import { BackIcon, PencilIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pipeline" });
  return { title: t("pageTitle") };
}

/**
 * One pipeline, read (T-014) -- the legacy `/app/pipelines/:id` route.
 *
 * A pipeline is a **dataflow graph**, and the payload does not contain its edges: boxes name
 * variables on their ports, and two boxes are connected exactly when one writes and another reads
 * the same name. So the first thing this screen does is draw it -- because a table of boxes with a
 * column of variable names is the same information in the form in which nobody can see the shape.
 *
 * The tables below the picture are what the picture cannot say: which variables have no producer
 * or no consumer (a pipeline's commonest defect), and which are **external references** -- the
 * `$name` holes an exercise's configuration fills in, and the reason T-009's editor knows what to
 * ask for.
 *
 * The exercises using it are listed last and are the reason to be careful: a pipeline is shared
 * machinery, and editing one changes every exercise configured against it.
 */
export default async function PipelinePage({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const [{ pipelineId }, locale] = await Promise.all([params, getLocale()]);
  const [t, pipeline] = await Promise.all([getTranslations("Pipeline"), getPipeline(pipelineId)]);

  const [exercises, environments, breadcrumbs] = await Promise.all([
    getPipelineExercises(pipelineId, locale),
    getRuntimeEnvironments(),
    resolveBreadcrumbs(`/pipelines/${pipelineId}`, locale),
  ]);

  const environmentNames = new Map(environments.map((entry) => [entry.id, entry.name]));
  const boxes = pipeline.pipeline.boxes ?? [];
  const variables = pipeline.pipeline.variables ?? [];
  const used = utilization(boxes);
  const activeParameters = Object.entries(pipeline.parameters)
    .filter(([, value]) => value)
    .map(([name]) => name);

  return (
    <PageShell
      title={pipeline.name}
      subtitle={pipeline.description.split("\n")[0] || undefined}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-2">
          {pipeline.can.update === true && (
            <Link
              href={`/pipelines/${pipelineId}/edit`}
              className={buttonClasses("warning-outline", "sm")}
            >
              <PencilIcon />
              {t("edit")}
            </Link>
          )}
          <Link href="/pipelines" className={buttonClasses("outline", "sm")}>
            <BackIcon />
            {t("backToList")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="pipeline-graph" className="flex flex-col gap-2">
          <div>
            <h2 id="pipeline-graph" className="text-base font-semibold tracking-tight">
              {t("structure")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("structureExplain")}</p>
          </div>
          <PipelineGraph
            structure={pipeline.pipeline}
            title={t("graphLabel", { name: pipeline.name })}
          />
        </section>

        <section aria-labelledby="pipeline-facts" className="flex flex-col gap-2">
          <h2 id="pipeline-facts" className="text-base font-semibold tracking-tight">
            {t("details")}
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">{t("environments")}</dt>
            <dd>
              {pipeline.runtimeEnvironmentIds
                .map((id) => environmentNames.get(id) ?? id)
                .join(", ") || t("noEnvironments")}
            </dd>
            <dt className="text-muted-foreground">{t("parameters")}</dt>
            <dd className="flex flex-wrap gap-1">
              {activeParameters.length === 0
                ? t("noParameters")
                : activeParameters.map((parameter) => (
                    <Badge key={parameter} tone="neutral">
                      {t.has(`parameters.${parameter}`) ? t(`parameters.${parameter}`) : parameter}
                    </Badge>
                  ))}
            </dd>
            <dt className="text-muted-foreground">{t("author")}</dt>
            <dd>{pipeline.authorName ?? t("instanceOwned")}</dd>
            <dt className="text-muted-foreground">{t("updated")}</dt>
            <dd>
              <DateTime unixSeconds={pipeline.updatedAt} />
            </dd>
          </dl>
          {/* Markdown, not preformatted text: legacy renders a pipeline's description through
              its own renderer (`PipelineDetail.js`). Found while building G-028. The subtitle
              above stays the first line as plain text -- a heading is not a place for a rendered
              document. */}
          {pipeline.description.includes("\n") && (
            <div className="max-w-prose text-sm">
              <Markdown source={pipeline.description} />
            </div>
          )}
        </section>

        <section aria-labelledby="pipeline-boxes" className="flex flex-col gap-2">
          <h2 id="pipeline-boxes" className="text-base font-semibold tracking-tight">
            {t("boxes", { count: boxes.length })}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("box.name")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("box.type")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("box.inputs")}
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    {t("box.outputs")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {boxes.map((box) => (
                  <tr key={box.name} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{box.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                      {box.type}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <PortList ports={ports(box.portsIn)} empty={t("box.none")} />
                    </td>
                    <td className="py-2 text-xs">
                      <PortList ports={ports(box.portsOut)} empty={t("box.none")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="pipeline-variables" className="flex flex-col gap-2">
          <div>
            <h2 id="pipeline-variables" className="text-base font-semibold tracking-tight">
              {t("variables", { count: variables.length })}
            </h2>
            <p className="text-sm text-muted-foreground">{t("variablesExplain")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("variable.name")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("variable.type")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("variable.value")}
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    {t("variable.wiring")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {variables.map((variable) => {
                  const entry = used[variable.name];
                  const producers = entry?.portsOut.length ?? 0;
                  const consumers = entry?.portsIn.length ?? 0;
                  const external = isExternalReference(variable.value);
                  return (
                    <tr key={variable.name} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-3 font-mono text-xs">{variable.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                        {variable.type}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {external ? (
                          <Badge tone="warning">{t("variable.external")}</Badge>
                        ) : Array.isArray(variable.value) ? (
                          variable.value.join(", ") || "—"
                        ) : (
                          variable.value || "—"
                        )}
                      </td>
                      <td className="py-2 text-xs">
                        <span className="flex flex-wrap gap-1">
                          {producers === 0 && !external && (
                            <Badge tone="warning">{t("variable.noProducer")}</Badge>
                          )}
                          {consumers === 0 && (
                            <Badge tone="neutral">{t("variable.noConsumer")}</Badge>
                          )}
                          {(producers > 0 || external) && consumers > 0 && (
                            <span className="text-muted-foreground">
                              {t("variable.wiredTo", { count: consumers })}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="pipeline-exercises" className="flex flex-col gap-2">
          <div>
            <h2 id="pipeline-exercises" className="text-base font-semibold tracking-tight">
              {t("exercises")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("exercisesExplain")}</p>
          </div>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noExercises")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {exercises.map((exercise) => (
                <li key={exercise.id}>
                  <Link
                    href={`/exercises/${exercise.id}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {exercise.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function PortList({
  ports: list,
  empty,
}: {
  ports: Record<string, { type: string; value: string }>;
  empty: string;
}) {
  const entries = Object.entries(list);
  if (entries.length === 0) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map(([port, definition]) => (
        <li key={port} className="font-mono">
          {port}
          <span className="text-muted-foreground">
            {" → "}
            {definition.value || "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
