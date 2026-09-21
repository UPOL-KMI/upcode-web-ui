import { formatExitCodes, parseExitCodes } from "./exit-codes";
import { appliesToPipeline, descriptorsFor, type VariableDescriptor } from "./descriptors";
import { ENV_DATA_ONLY } from "./environments";
import type {
  ConfigEnvironment,
  ConfigPipeline,
  ConfigPipelineDefinition,
  ConfigVariable,
  ExerciseConfig,
  ExerciseTest,
} from "./types";

/**
 * The two halves of the simple configuration editor (T-009): reading core-api's
 * environment/test/pipeline/variable tree into something a form can bind to, and folding the form
 * back into that tree.
 *
 * **Reading and writing are deliberately asymmetric**, which is the one thing to understand here.
 * Reading looks through every pipeline the configuration happens to name and takes the first
 * variable with the right name -- so a configuration written by hand, or by the advanced editor,
 * or by an older version of the app, still loads. Writing rebuilds the pipeline list from
 * scratch: for each environment the exercise supports, `relevantPipelines()` picks the compilation
 * and execution pipelines the instance offers, and each variable is placed in whichever of those
 * declares it. That asymmetry is the legacy behaviour and it is what makes the form a *normaliser*
 * -- saving without touching anything is not a no-op, it rewrites the configuration into the shape
 * the simple editor can express.
 *
 * **Which variables a pipeline's entry may hold is core-api's answer, not this app's guess.**
 * `POST /exercises/{id}/config/variables` says, for a chosen environment and pipeline list,
 * exactly what each pipeline declares -- and core-api refuses a configuration holding anything
 * else ("Variable 'extra-files' is redundant in pipeline ..., environment python3", found by
 * writing one). So the writer is given that answer and emits exactly those names: the descriptors
 * supply the values it knows, the declaration supplies the defaults for the rest, and a value
 * already stored under the same name and type is carried across. Nothing outside the declaration
 * survives, because nothing outside it can (DEC-102, corrected).
 */
export interface FileEntry {
  /** The exercise file's name, as stored. */
  file: string;
  /** What it is called inside the sandbox; empty means "the same". */
  name: string;
}

export interface TestEnvironmentValues {
  entryPoint: string;
  successExitCodes: string;
  extraFiles: FileEntry[];
  jarFiles: string[];
  compileArgs: string[];
  execTargets: string[];
}

export interface TestConfigValues {
  /** The exercise test's id, as a string -- form keys are strings. */
  id: string;
  expectedOutput: string;
  stdinFile: string;
  inputFiles: FileEntry[];
  judgeType: string;
  useCustomJudge: boolean;
  customJudge: string;
  judgeArgs: string[];
  runArgs: string[];
  useOutFile: boolean;
  actualOutput: string;
  /** Haskell names its entry point rather than pointing at a file. */
  entryPointString: string;
  environments: Record<string, TestEnvironmentValues>;
}

export interface SimpleConfigValues {
  tests: TestConfigValues[];
}

/** core-api writes an unset entry point as this sentinel rather than an empty string. */
const ENTRY_POINT_SENTINEL = "$entry-point";

const EMPTY_ENVIRONMENT: TestEnvironmentValues = {
  entryPoint: "",
  successExitCodes: "0",
  extraFiles: [],
  jarFiles: [],
  compileArgs: [],
  execTargets: [],
};

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asScalar(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function testPipelines(
  config: ExerciseConfig,
  environmentId: string | null,
  testId: string,
): ConfigPipeline[] {
  const environment =
    environmentId === null ? config[0] : config.find((entry) => entry.name === environmentId);
  const test = environment?.tests.find((entry) => String(entry.name) === testId);
  return test?.pipelines ?? [];
}

function findVariable(pipelines: ConfigPipeline[], name: string): ConfigVariable | undefined {
  for (const pipeline of pipelines) {
    const variable = pipeline.variables.find((entry) => entry.name === name);
    if (variable) return variable;
  }
  return undefined;
}

function readFilePairs(pipelines: ConfigPipeline[], descriptor: VariableDescriptor): FileEntry[] {
  const files = asArray(findVariable(pipelines, descriptor.variable)?.value);
  const names = asArray(
    descriptor.namesVariable ? findVariable(pipelines, descriptor.namesVariable)?.value : undefined,
  );
  return files.map((file, index) => ({ file, name: (names[index] ?? "").trim() }));
}

function readScalar(pipelines: ConfigPipeline[], descriptor: VariableDescriptor): string {
  const variable = findVariable(pipelines, descriptor.variable);
  if (!variable) return asScalar(descriptor.fallback);
  return asScalar(variable.value).trim();
}

function readList(pipelines: ConfigPipeline[], descriptor: VariableDescriptor): string[] {
  const variable = findVariable(pipelines, descriptor.variable);
  if (!variable) return asArray(descriptor.fallback);
  return asArray(variable.value);
}

/** Every value of one test, as the form binds it. */
function readTest(
  config: ExerciseConfig,
  testId: string,
  environmentIds: string[],
  descriptors: VariableDescriptor[],
): TestConfigValues {
  const shared = testPipelines(config, null, testId);

  const values: TestConfigValues = {
    id: testId,
    expectedOutput: "",
    stdinFile: "",
    inputFiles: [],
    judgeType: "recodex-judge-normal",
    useCustomJudge: false,
    customJudge: "",
    judgeArgs: [],
    runArgs: [],
    useOutFile: false,
    actualOutput: "",
    entryPointString: "",
    environments: Object.fromEntries(
      environmentIds.map((id) => [id, { ...EMPTY_ENVIRONMENT, extraFiles: [] }]),
    ),
  };

  for (const descriptor of descriptors) {
    if (descriptor.perEnvironment) {
      for (const environmentId of environmentIds) {
        const pipelines = testPipelines(config, environmentId, testId);
        const environment = values.environments[environmentId];
        if (!environment) continue;
        switch (descriptor.prop) {
          case "entryPoint": {
            const value = readScalar(pipelines, descriptor);
            environment.entryPoint = value === ENTRY_POINT_SENTINEL ? "" : value;
            break;
          }
          case "successExitCodes":
            environment.successExitCodes = formatExitCodes(readList(pipelines, descriptor));
            break;
          case "extraFiles":
            environment.extraFiles = readFilePairs(pipelines, descriptor);
            break;
          case "jarFiles":
            environment.jarFiles = readList(pipelines, descriptor);
            break;
          case "compileArgs":
            environment.compileArgs = readList(pipelines, descriptor);
            break;
          case "execTargets":
            environment.execTargets = readList(pipelines, descriptor);
            break;
        }
      }
      continue;
    }

    switch (descriptor.prop) {
      case "expectedOutput":
        values.expectedOutput = readScalar(shared, descriptor);
        break;
      case "stdinFile":
        values.stdinFile = readScalar(shared, descriptor);
        break;
      case "inputFiles":
        values.inputFiles = readFilePairs(shared, descriptor);
        break;
      case "judgeType":
        values.judgeType = readScalar(shared, descriptor);
        break;
      case "customJudge":
        values.customJudge = readScalar(shared, descriptor);
        break;
      case "judgeArgs":
        values.judgeArgs = readList(shared, descriptor);
        break;
      case "runArgs":
        values.runArgs = readList(shared, descriptor);
        break;
      case "actualOutput":
        values.actualOutput = readScalar(shared, descriptor);
        break;
      case "entryPointString":
        values.entryPointString = readScalar(shared, descriptor);
        break;
    }
  }

  // Two checkboxes that are not variables of their own: the configuration says which judge and
  // which output channel by *what it holds*, and the form needs a boolean to switch the fields on.
  values.useCustomJudge = values.customJudge !== "";
  if (values.useCustomJudge) values.judgeType = "";
  else if (values.judgeType === "") values.judgeType = "recodex-judge-normal";
  values.useOutFile = values.actualOutput !== "";

  return values;
}

export function readSimpleConfig(
  config: ExerciseConfig,
  tests: ExerciseTest[],
  environmentIds: string[],
): SimpleConfigValues {
  const descriptors = descriptorsFor(environmentIds);
  return {
    tests: tests.map((test) => readTest(config, String(test.id), environmentIds, descriptors)),
  };
}

/**
 * The pipelines a test is written into for one environment: the instance's pipelines for that
 * environment, minus the execution pipelines for the *other* output channel. The one environment
 * with no execution of its own (`data-linux`) keeps only its judge pipeline. Compilation comes first, which is the
 * order core-api's own executor reads them in.
 */
export function relevantPipelines(
  pipelines: ConfigPipelineDefinition[],
  environmentId: string,
  useOutFile: boolean,
): ConfigPipelineDefinition[] {
  const forEnvironment = pipelines.filter((pipeline) =>
    pipeline.runtimeEnvironmentIds.includes(environmentId),
  );

  const selected =
    environmentId === ENV_DATA_ONLY
      ? forEnvironment.filter((pipeline) => pipeline.parameters.judgeOnlyPipeline)
      : forEnvironment.filter(
          (pipeline) =>
            !pipeline.parameters.judgeOnlyPipeline &&
            (!pipeline.parameters.isExecutionPipeline ||
              (useOutFile
                ? pipeline.parameters.producesFiles
                : pipeline.parameters.producesStdout)),
        );

  return [...selected].sort((a, b) =>
    a.parameters.isCompilationPipeline === b.parameters.isCompilationPipeline
      ? 0
      : a.parameters.isCompilationPipeline
        ? -1
        : 1,
  );
}

function writeVariables(
  descriptor: VariableDescriptor,
  test: TestConfigValues,
  environmentId: string,
): ConfigVariable[] {
  const environment = test.environments[environmentId] ?? EMPTY_ENVIRONMENT;

  switch (descriptor.prop) {
    case "expectedOutput":
      return [{ name: descriptor.variable, type: descriptor.type, value: test.expectedOutput }];
    case "stdinFile":
      return [{ name: descriptor.variable, type: descriptor.type, value: test.stdinFile }];
    case "judgeType":
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          value: test.useCustomJudge ? "" : test.judgeType,
        },
      ];
    case "customJudge":
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          value: test.useCustomJudge ? test.customJudge : "",
        },
      ];
    case "judgeArgs":
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          value: test.useCustomJudge ? test.judgeArgs : [],
        },
      ];
    case "runArgs":
      return [{ name: descriptor.variable, type: descriptor.type, value: test.runArgs }];
    case "actualOutput":
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          value: test.useOutFile ? test.actualOutput : "",
        },
      ];
    case "entryPointString":
      return [{ name: descriptor.variable, type: descriptor.type, value: test.entryPointString }];
    case "inputFiles":
    case "extraFiles": {
      // **An empty name means "keep the one it already has", which is what the field promises.**
      // The second box is labelled "(optional) new file name" and used to be written through as
      // an empty string, which is not a name at all: the worker builds the destination as
      // `<directory>/<name>`, so an empty one resolves to the directory itself and the job dies
      // with `Cannot open file /var/recodex-worker-wd/.../01-dot-product/ for writing` -- a
      // message that names neither the field nor the test row that caused it. Reproduced on a live
      // deployment before this was written, and confirmed fixed the same way.
      //
      // A row with no file chosen at all is dropped rather than written as an empty entry, for the
      // same reason: the select offers "no file", and passing that through only moves the failure
      // somewhere it cannot be read.
      const entries = (
        descriptor.prop === "inputFiles" ? test.inputFiles : environment.extraFiles
      ).filter((entry) => entry.file !== "");
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          value: entries.map((entry) => entry.file),
        },
        {
          name: descriptor.namesVariable!,
          type: "file[]",
          value: entries.map((entry) => entry.name.trim() || entry.file),
        },
      ];
    }
    case "entryPoint":
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          // An empty entry point is not an empty string in the configuration: core-api expects the
          // sentinel, which is what tells the executor to take the submitted file instead.
          value: environment.entryPoint || ENTRY_POINT_SENTINEL,
        },
      ];
    case "successExitCodes":
      return [
        {
          name: descriptor.variable,
          type: descriptor.type,
          value: parseExitCodes(environment.successExitCodes),
        },
      ];
    case "jarFiles":
      return [{ name: descriptor.variable, type: descriptor.type, value: environment.jarFiles }];
    case "compileArgs":
      return [{ name: descriptor.variable, type: descriptor.type, value: environment.compileArgs }];
    case "execTargets":
      return [{ name: descriptor.variable, type: descriptor.type, value: environment.execTargets }];
  }

  return [];
}

/**
 * The variables one pipeline's entry gets: exactly the names it declares, valued from the form
 * where the vocabulary covers them, from what is already stored where the name and type still
 * match, and from the pipeline's own default otherwise.
 *
 * With no declaration to go on -- an instance that did not answer, or a caller that did not ask --
 * this falls back to what the descriptors produced, which is what the form can express and is
 * never *more* than a pipeline declares.
 */
function variablesFor(
  written: ConfigVariable[],
  stored: ConfigVariable[],
  declared: ConfigVariable[] | undefined,
): ConfigVariable[] {
  if (!declared) return written;
  const fromForm = new Map(written.map((variable) => [variable.name, variable]));
  const fromConfig = new Map(stored.map((variable) => [variable.name, variable]));
  return declared.map((variable) => {
    const supplied = fromForm.get(variable.name);
    if (supplied && supplied.type === variable.type) return supplied;
    const existing = fromConfig.get(variable.name);
    if (existing && existing.type === variable.type) return { ...existing };
    return { ...variable };
  });
}

/**
 * What each pipeline declares, keyed by environment and then pipeline -- core-api's own answer
 * from `/config/variables`, which the caller asks for and passes in.
 */
export type DeclaredVariables = Record<string, Record<string, ConfigVariable[]>>;

export function writeSimpleConfig(
  values: SimpleConfigValues,
  environmentIds: string[],
  pipelines: ConfigPipelineDefinition[],
  original: ExerciseConfig,
  declared?: DeclaredVariables,
): ExerciseConfig {
  const descriptors = descriptorsFor(environmentIds);

  return environmentIds.map<ConfigEnvironment>((environmentId) => ({
    name: environmentId,
    tests: values.tests.map((test) => ({
      name: Number(test.id),
      pipelines: relevantPipelines(pipelines, environmentId, test.useOutFile).map((pipeline) => {
        const written = descriptors
          .filter((descriptor) => appliesToPipeline(descriptor, pipeline))
          .flatMap((descriptor) => writeVariables(descriptor, test, environmentId));

        const stored =
          testPipelines(original, environmentId, test.id).find(
            (entry) => entry.name === pipeline.id,
          )?.variables ?? [];

        return {
          name: pipeline.id,
          variables: variablesFor(written, stored, declared?.[environmentId]?.[pipeline.id]),
        };
      }),
    })),
  }));
}

export interface EnvironmentFields {
  entryPoint: boolean;
  successExitCodes: boolean;
  extraFiles: boolean;
  jarFiles: boolean;
  compileArgs: boolean;
  execTargets: boolean;
}

export interface ConfigCapabilities {
  /** Which per-environment fields the form shows, and for which environment. */
  environments: Record<string, EnvironmentFields>;
  /** Whether any environment offers a pipeline that compares a produced file instead of stdout. */
  canCompareFile: boolean;
  /**
   * Whether a test must name the file its output is compared against.
   *
   * **Read off the instance's own pipelines, not assumed from the language.** A pipeline that
   * declares `expected-output` is one whose judge is handed that file, and core-api refuses to
   * compile a configuration that leaves it empty -- "Different count of remote variables and local
   * variables in box 'expected'", which reaches a teacher as "the chosen languages have no
   * configuration" and explains nothing. The data-only pipeline declares no such variable, which is
   * exactly why a data-only exercise saves happily with every file field empty.
   */
  needsExpectedOutput: boolean;
  /** Environments with no pipeline at all -- nothing can be configured for them. */
  withoutPipelines: string[];
}

/**
 * What the per-test form may offer, worked out from the instance's pipelines rather than assumed.
 * A field exists for an environment only where some pipeline of that environment declares it: Java
 * has no entry point to choose, C has no jar files, and offering either would be a control whose
 * value core-api would refuse to store.
 */
export function configCapabilities(
  environmentIds: string[],
  pipelines: ConfigPipelineDefinition[],
  /** What each pipeline declares, by pipeline id -- see `needsExpectedOutput`. */
  pipelineVariables: { id: string; pipeline?: { variables?: { name: string }[] } }[] = [],
): ConfigCapabilities {
  const descriptors = descriptorsFor(environmentIds);
  const perEnvironment = descriptors.filter((descriptor) => descriptor.perEnvironment);

  const environments: Record<string, EnvironmentFields> = {};
  const withoutPipelines: string[] = [];
  let canCompareFile = false;
  let needsExpectedOutput = false;
  const declared = new Map(
    pipelineVariables.map((entry) => [
      entry.id,
      (entry.pipeline?.variables ?? []).map((variable) => variable.name),
    ]),
  );

  for (const environmentId of environmentIds) {
    const forEnvironment = pipelines.filter((pipeline) =>
      pipeline.runtimeEnvironmentIds.includes(environmentId),
    );
    if (forEnvironment.length === 0) withoutPipelines.push(environmentId);
    if (forEnvironment.some((pipeline) => pipeline.parameters.producesFiles)) canCompareFile = true;
    if (forEnvironment.some((pipeline) => declared.get(pipeline.id)?.includes("expected-output"))) {
      needsExpectedOutput = true;
    }

    const fields: EnvironmentFields = {
      entryPoint: false,
      successExitCodes: false,
      extraFiles: false,
      jarFiles: false,
      compileArgs: false,
      execTargets: false,
    };
    for (const descriptor of perEnvironment) {
      if (forEnvironment.some((pipeline) => appliesToPipeline(descriptor, pipeline))) {
        fields[descriptor.prop as keyof EnvironmentFields] = true;
      }
    }
    environments[environmentId] = fields;
  }

  return { environments, canCompareFile, needsExpectedOutput, withoutPipelines };
}
