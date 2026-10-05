"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { submitSolutionSchema, type SubmitSolutionValues } from "./submit-solution.schema";

/**
 * Submitting a solution (S-014), and the pre-flight that precedes it.
 *
 * Server Actions rather than Route Handlers, for the two calls that are small JSON: the token
 * stays server-side (brief §5) and the form kit (D-004) is built to call an action directly. The
 * **files** do not come through here -- they are already uploaded, chunk by chunk, through D-005's
 * Route Handler, and what reaches this action is a list of ids core-api has already accepted.
 * That split is AGENTS.md footgun 7 exactly: a Server Action's request body limit is around 1 MB,
 * and ReCodEx solutions are archives.
 *
 * Neither action re-checks whether the reader may submit. core-api's `canReceiveSubmissions()`
 * folds in the deadline, the attempt limit, the group's licence, exam locks and a system-wide
 * submission lock, and it runs on the real submit regardless of what this app believes -- so the
 * only thing a second implementation here could do is disagree with it.
 */
export interface PreSubmitResult {
  /** Runtime environments core-api considers plausible for the uploaded file names. */
  environments: string[];
  /**
   * The environments whose configuration leaves the entry point to the submitter.
   *
   * An exercise config may bind `entry-point` to the sentinel `$entry-point`, which makes it a
   * *submit-time* variable: core-api refuses the submission outright
   * (`Variable 'entry-point' was not provided on submit`) unless `solutionParams` carries it. This
   * is the only such variable ReCodEx defines, so it is reported as a list of environments rather
   * than as a general variable table -- a table nothing would read the other columns of.
   */
  entryPointEnvironments: string[];
  countLimitOk: boolean;
  sizeLimitOk: boolean;
}

interface PreSubmitPayload {
  environments: string[];
  submitVariables?: { runtimeEnvironmentId: string; variables: { name: string }[] }[];
  countLimitOK: boolean;
  sizeLimitOK: boolean;
}

const ENTRY_POINT_VARIABLE = "entry-point";

export async function preSubmitSolution(
  assignmentId: string,
  files: string[],
): Promise<ActionResult<PreSubmitResult>> {
  const t = await getTranslations("Submit.errors");
  try {
    const payload = await apiPost<PreSubmitPayload>(
      "/v1/exercise-assignments/{id}/pre-submit",
      { files },
      { pathParams: { id: assignmentId } },
    );
    return {
      success: true,
      data: {
        environments: payload.environments ?? [],
        entryPointEnvironments: (payload.submitVariables ?? [])
          .filter((entry) =>
            entry.variables.some((variable) => variable.name === ENTRY_POINT_VARIABLE),
          )
          .map((entry) => entry.runtimeEnvironmentId),
        countLimitOk: payload.countLimitOK,
        sizeLimitOk: payload.sizeLimitOK,
      },
    };
  } catch (error) {
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("preSubmitFailed"),
    };
  }
}

export interface SubmittedSolution {
  solutionId: string;
  /** The monitor channel this job reports progress on (S-016). core-api discloses it **once**, in
   *  this response -- there is no endpoint that returns it later, which is why the submit form
   *  carries it to the solution screen rather than that screen asking for it. */
  monitorChannelId: string | null;
  expectedTasks: number;
}

export async function submitSolution(
  assignmentId: string,
  values: SubmitSolutionValues,
): Promise<ActionResult<SubmittedSolution>> {
  const t = await getTranslations("Submit.errors");

  // Re-validated here rather than trusted from the client: this function is reachable as an HTTP
  // endpoint whatever the form did.
  const parsed = submitSolutionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field) fieldErrors[field] = issue.message;
    }
    return { success: false, formError: t("invalid"), fieldErrors };
  }

  try {
    const payload = await apiPost<{
      solution: { id: string };
      webSocketChannel?: { id: string; expectedTasksCount: number };
    }>(
      "/v1/exercise-assignments/{id}/submit",
      {
        note: parsed.data.note,
        files: parsed.data.files,
        runtimeEnvironmentId: parsed.data.runtimeEnvironmentId,
        // Sent only when the form resolved one: core-api stores `solutionParams` on the solution
        // and replays them on a re-run, so an empty entry here would be persisted as an empty
        // entry point rather than read as "no such variable".
        ...(parsed.data.entryPoint
          ? {
              solutionParams: {
                variables: [{ name: ENTRY_POINT_VARIABLE, value: parsed.data.entryPoint }],
              },
            }
          : {}),
      },
      { pathParams: { id: assignmentId } },
    );
    return {
      success: true,
      data: {
        solutionId: payload.solution.id,
        monitorChannelId: payload.webSocketChannel?.id ?? null,
        expectedTasks: payload.webSocketChannel?.expectedTasksCount ?? 0,
      },
    };
  } catch (error) {
    // core-api's own message is the useful one here -- it is what says *why* a submission was
    // refused (past the deadline, out of attempts, group licence expired), and this app cannot
    // reconstruct that from a status code. Not for its own failures, though: a 500 reads
    // "Unexpected Error App\Helpers\FileStorage\FileStorageException", and by then core-api may
    // have taken the uploads already, so trying again with the same files only fails differently.
    if (error instanceof ApiError && error.httpStatus >= 500) {
      return { success: false, formError: t("serverFailed") };
    }
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("submitFailed"),
    };
  }
}
