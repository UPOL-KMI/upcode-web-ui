import { describe, expect, it } from "vitest";

import {
  configCapabilities,
  readSimpleConfig,
  relevantPipelines,
  writeSimpleConfig,
} from "./simple-config";
import type { ConfigPipelineDefinition, ExerciseConfig, ExerciseTest } from "./types";

/**
 * The instance's own python3 and java pipelines, verbatim -- every `parameters` flag is present
 * with a boolean, which matters: a descriptor's pipeline filter treats a *missing* flag as "does
 * not apply", so a fixture that omits the false ones would place variables nowhere.
 */
const PIPELINES: ConfigPipelineDefinition[] = [
  {
    id: "compile-passthrough",
    name: "Compilation source files pass-through",
    runtimeEnvironmentIds: ["bash", "python3"],
    parameters: {
      isCompilationPipeline: true,
      isExecutionPipeline: false,
      judgeOnlyPipeline: false,
      producesStdout: false,
      producesFiles: false,
      hasEntryPoint: false,
      hasExtraFiles: false,
      hasSuccessExitCodes: false,
    },
  },
  {
    id: "python-stdout",
    name: "Python execution & evaluation [stdout]",
    runtimeEnvironmentIds: ["python3"],
    parameters: {
      isCompilationPipeline: false,
      isExecutionPipeline: true,
      judgeOnlyPipeline: false,
      producesStdout: true,
      producesFiles: false,
      hasEntryPoint: true,
      hasExtraFiles: false,
      hasSuccessExitCodes: true,
    },
  },
  {
    id: "python-outfile",
    name: "Python execution & evaluation [outfile]",
    runtimeEnvironmentIds: ["python3"],
    parameters: {
      isCompilationPipeline: false,
      isExecutionPipeline: true,
      judgeOnlyPipeline: false,
      producesStdout: false,
      producesFiles: true,
      hasEntryPoint: true,
      hasExtraFiles: false,
      hasSuccessExitCodes: true,
    },
  },
  {
    id: "javac",
    name: "Javac Compilation",
    runtimeEnvironmentIds: ["java"],
    parameters: {
      isCompilationPipeline: true,
      isExecutionPipeline: false,
      judgeOnlyPipeline: false,
      producesStdout: false,
      producesFiles: false,
      hasEntryPoint: false,
      hasExtraFiles: false,
      hasSuccessExitCodes: false,
    },
  },
  {
    id: "java-stdout",
    name: "Java execution & evaluation [stdout]",
    runtimeEnvironmentIds: ["java"],
    parameters: {
      isCompilationPipeline: false,
      isExecutionPipeline: true,
      judgeOnlyPipeline: false,
      producesStdout: true,
      producesFiles: false,
      hasEntryPoint: false,
      hasExtraFiles: false,
      hasSuccessExitCodes: true,
    },
  },
];

const TESTS: ExerciseTest[] = [{ id: 1, name: "Test 1", description: "" }];

/** The seeded exercise's configuration, as core-api returns it. */
const SEEDED: ExerciseConfig = [
  {
    name: "python3",
    tests: [
      {
        name: 1,
        pipelines: [
          {
            name: "python-stdout",
            variables: [
              { name: "custom-judge", type: "remote-file", value: "" },
              { name: "expected-output", type: "remote-file", value: "expected.txt" },
              { name: "extra-files", type: "remote-file[]", value: [] },
              { name: "stdin-file", type: "remote-file", value: "" },
              { name: "input-files", type: "remote-file[]", value: [] },
              { name: "entry-point", type: "file", value: "" },
              { name: "actual-inputs", type: "file[]", value: [] },
              { name: "judge-args", type: "string[]", value: [] },
              { name: "judge-type", type: "string", value: "recodex-judge-normal" },
              { name: "run-args", type: "string[]", value: [] },
              { name: "success-exit-codes", type: "string[]", value: ["0"] },
            ],
          },
        ],
      },
    ],
  },
];

describe("readSimpleConfig", () => {
  it("reads a live configuration into form values", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    const test = values.tests[0]!;

    expect(test.id).toBe("1");
    expect(test.expectedOutput).toBe("expected.txt");
    expect(test.judgeType).toBe("recodex-judge-normal");
    expect(test.useCustomJudge).toBe(false);
    expect(test.useOutFile).toBe(false);
    expect(test.environments.python3!.successExitCodes).toBe("0");
    expect(test.environments.python3!.entryPoint).toBe("");
  });

  it("infers the two checkboxes from what the configuration holds", () => {
    const withJudge = structuredClone(SEEDED);
    const variables = withJudge[0]!.tests[0]!.pipelines[0]!.variables;
    variables.find((v) => v.name === "custom-judge")!.value = "judge.py";
    variables.find((v) => v.name === "judge-type")!.value = "";

    const test = readSimpleConfig(withJudge, TESTS, ["python3"]).tests[0]!;
    expect(test.useCustomJudge).toBe(true);
    expect(test.customJudge).toBe("judge.py");
  });

  it("reads the entry-point sentinel as no entry point", () => {
    const withSentinel = structuredClone(SEEDED);
    withSentinel[0]!.tests[0]!.pipelines[0]!.variables.find(
      (v) => v.name === "entry-point",
    )!.value = "$entry-point";
    const test = readSimpleConfig(withSentinel, TESTS, ["python3"]).tests[0]!;
    expect(test.environments.python3!.entryPoint).toBe("");
  });

  it("pairs input files with the names they are given in the sandbox", () => {
    const withInputs = structuredClone(SEEDED);
    const variables = withInputs[0]!.tests[0]!.pipelines[0]!.variables;
    variables.find((v) => v.name === "input-files")!.value = ["data-01.txt", "data-02.txt"];
    variables.find((v) => v.name === "actual-inputs")!.value = ["input.txt", ""];

    const test = readSimpleConfig(withInputs, TESTS, ["python3"]).tests[0]!;
    expect(test.inputFiles).toEqual([
      { file: "data-01.txt", name: "input.txt" },
      { file: "data-02.txt", name: "" },
    ]);
  });

  it("falls back to the descriptor's default when a variable is absent", () => {
    const empty: ExerciseConfig = [{ name: "python3", tests: [{ name: 1, pipelines: [] }] }];
    const test = readSimpleConfig(empty, TESTS, ["python3"]).tests[0]!;
    expect(test.judgeType).toBe("recodex-judge-normal");
    expect(test.environments.python3!.successExitCodes).toBe("0");
    expect(test.inputFiles).toEqual([]);
  });
});

describe("relevantPipelines", () => {
  it("picks the stdout execution pipeline and puts compilation first", () => {
    expect(relevantPipelines(PIPELINES, "python3", false).map((p) => p.id)).toEqual([
      "compile-passthrough",
      "python-stdout",
    ]);
  });

  it("swaps to the file-producing pipeline when the test compares a file", () => {
    expect(relevantPipelines(PIPELINES, "python3", true).map((p) => p.id)).toEqual([
      "compile-passthrough",
      "python-outfile",
    ]);
  });

  it("ignores pipelines belonging to another environment", () => {
    expect(relevantPipelines(PIPELINES, "java", false).map((p) => p.id)).toEqual([
      "javac",
      "java-stdout",
    ]);
  });
});

describe("writeSimpleConfig", () => {
  it("writes each variable into the pipeline that declares it", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    const config = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED);

    expect(config).toHaveLength(1);
    expect(config[0]!.name).toBe("python3");
    expect(config[0]!.tests[0]!.name).toBe(1);

    const names = config[0]!.tests[0]!.pipelines.map((pipeline) => pipeline.name);
    expect(names).toEqual(["compile-passthrough", "python-stdout"]);

    const execution = config[0]!.tests[0]!.pipelines[1]!.variables;
    expect(execution.find((v) => v.name === "expected-output")?.value).toBe("expected.txt");
    // The entry point is written as core-api's sentinel, never as an empty string.
    expect(execution.find((v) => v.name === "entry-point")?.value).toBe("$entry-point");
    expect(execution.find((v) => v.name === "success-exit-codes")?.value).toEqual(["0"]);
    // Extra files are a compilation variable, so that is where they are written -- and they are
    // not left in the execution pipeline, which is what core-api calls redundant.
    const compilation = config[0]!.tests[0]!.pipelines[0]!.variables;
    expect(compilation.find((v) => v.name === "extra-files")?.value).toEqual([]);
    expect(compilation.find((v) => v.name === "expected-output")).toBeUndefined();
    expect(execution.find((v) => v.name === "extra-files")).toBeUndefined();
  });

  it("writes exactly the variables a pipeline declares, and nothing else", () => {
    // core-api refuses anything a pipeline does not declare ("Variable 'extra-files' is redundant
    // in pipeline ...") -- found by writing one, and the reason the declaration is passed in
    // rather than the writer guessing from the descriptor table.
    const declared = {
      python3: {
        "python-stdout": [
          { name: "expected-output", type: "remote-file", value: "" },
          { name: "judge-type", type: "string", value: "" },
        ],
        "compile-passthrough": [{ name: "extra-files", type: "remote-file[]", value: [] }],
      },
    };
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    const config = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED, declared);

    const execution = config[0]!.tests[0]!.pipelines.find((p) => p.name === "python-stdout")!;
    expect(execution.variables.map((v) => v.name)).toEqual(["expected-output", "judge-type"]);
    // The form's own value wins where the vocabulary covers the variable.
    expect(execution.variables[0]!.value).toBe("expected.txt");
  });

  it("carries a stored value the form has no field for, when the pipeline still declares it", () => {
    const withStranger = structuredClone(SEEDED);
    withStranger[0]!.tests[0]!.pipelines[0]!.variables.push({
      name: "future-variable",
      type: "string",
      value: "keep me",
    });
    const declared = {
      python3: {
        "python-stdout": [{ name: "future-variable", type: "string", value: "" }],
        "compile-passthrough": [],
      },
    };

    const values = readSimpleConfig(withStranger, TESTS, ["python3"]);
    const config = writeSimpleConfig(values, ["python3"], PIPELINES, withStranger, declared);
    const execution = config[0]!.tests[0]!.pipelines.find((p) => p.name === "python-stdout")!;
    expect(execution.variables).toEqual([
      { name: "future-variable", type: "string", value: "keep me" },
    ]);
  });

  it("falls back to what the form can express when nothing declared anything", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    const config = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED);
    const execution = config[0]!.tests[0]!.pipelines.find((p) => p.name === "python-stdout")!;
    expect(execution.variables.find((v) => v.name === "expected-output")?.value).toBe(
      "expected.txt",
    );
    expect(execution.variables.find((v) => v.name === "extra-files")).toBeUndefined();
  });

  it("blanks the judge type when a custom judge is used, and the reverse", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    values.tests[0]!.useCustomJudge = true;
    values.tests[0]!.customJudge = "judge.py";
    values.tests[0]!.judgeArgs = ["--strict"];

    const custom = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED)[0]!.tests[0]!
      .pipelines[1]!.variables;
    expect(custom.find((v) => v.name === "judge-type")?.value).toBe("");
    expect(custom.find((v) => v.name === "custom-judge")?.value).toBe("judge.py");
    expect(custom.find((v) => v.name === "judge-args")?.value).toEqual(["--strict"]);

    values.tests[0]!.useCustomJudge = false;
    const builtin = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED)[0]!.tests[0]!
      .pipelines[1]!.variables;
    expect(builtin.find((v) => v.name === "judge-type")?.value).toBe("recodex-judge-normal");
    expect(builtin.find((v) => v.name === "custom-judge")?.value).toBe("");
    // The arguments belong to the custom judge, so they go with it.
    expect(builtin.find((v) => v.name === "judge-args")?.value).toEqual([]);
  });

  it("splits a file list into its files and their sandbox names", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    values.tests[0]!.inputFiles = [
      { file: "data-01.txt", name: "input.txt" },
      { file: "data-02.txt", name: "" },
    ];

    const execution = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED)[0]!.tests[0]!
      .pipelines[1]!.variables;
    expect(execution.find((v) => v.name === "input-files")?.value).toEqual([
      "data-01.txt",
      "data-02.txt",
    ]);
    // **The second name is the file's own**, because the field says the new name is optional.
    // Writing the empty string through produced `<directory>/` as the destination and killed the
    // whole job on the worker with a message naming a directory and no field.
    expect(execution.find((v) => v.name === "actual-inputs")?.value).toEqual([
      "input.txt",
      "data-02.txt",
    ]);
  });

  it("keeps a renamed file renamed, and does not touch a name that was typed", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    values.tests[0]!.inputFiles = [{ file: "data-01.txt", name: "  input.txt  " }];

    const execution = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED)[0]!.tests[0]!
      .pipelines[1]!.variables;
    expect(execution.find((v) => v.name === "actual-inputs")?.value).toEqual(["input.txt"]);
  });

  it("drops a row where no file was chosen, rather than writing an empty one", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    values.tests[0]!.inputFiles = [
      { file: "", name: "" },
      { file: "data-01.txt", name: "" },
      { file: "", name: "orphan.txt" },
    ];

    const execution = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED)[0]!.tests[0]!
      .pipelines[1]!.variables;
    expect(execution.find((v) => v.name === "input-files")?.value).toEqual(["data-01.txt"]);
    expect(execution.find((v) => v.name === "actual-inputs")?.value).toEqual(["data-01.txt"]);
  });

  it("applies the same rule to the extra files a test compiles with", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    values.tests[0]!.environments.python3!.extraFiles = [
      { file: "main.py", name: "" },
      { file: "helper.py", name: "lib.py" },
    ];

    const compilation = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED)[0]!.tests[0]!
      .pipelines[0]!.variables;
    expect(compilation.find((v) => v.name === "extra-files")?.value).toEqual([
      "main.py",
      "helper.py",
    ]);
    expect(compilation.find((v) => v.name === "extra-file-names")?.value).toEqual([
      "main.py",
      "lib.py",
    ]);
  });

  it("writes one branch per environment, sharing the values that are shared", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    values.tests[0]!.environments.java = {
      entryPoint: "",
      successExitCodes: "0, 2",
      extraFiles: [],
      jarFiles: ["helper.jar"],
      compileArgs: [],
      execTargets: [],
    };

    const config = writeSimpleConfig(values, ["python3", "java"], PIPELINES, SEEDED);
    expect(config.map((environment) => environment.name)).toEqual(["python3", "java"]);

    const javac = config[1]!.tests[0]!.pipelines.find((p) => p.name === "javac")!;
    expect(javac.variables.find((v) => v.name === "jar-files")?.value).toEqual(["helper.jar"]);

    const javaExec = config[1]!.tests[0]!.pipelines.find((p) => p.name === "java-stdout")!;
    expect(javaExec.variables.find((v) => v.name === "expected-output")?.value).toBe(
      "expected.txt",
    );
    expect(javaExec.variables.find((v) => v.name === "success-exit-codes")?.value).toEqual([
      "0",
      "2",
    ]);
    // Java has no entry point in its pipelines, so none is written for it.
    expect(javaExec.variables.find((v) => v.name === "entry-point")).toBeUndefined();
  });

  it("survives a round trip through the form untouched", () => {
    const values = readSimpleConfig(SEEDED, TESTS, ["python3"]);
    const written = writeSimpleConfig(values, ["python3"], PIPELINES, SEEDED);
    const reread = readSimpleConfig(written, TESTS, ["python3"]);
    expect(reread).toEqual(values);
  });
});

describe("configCapabilities", () => {
  it("offers a field only where a pipeline of that environment declares it", () => {
    const { environments } = configCapabilities(["python3", "java"], PIPELINES);

    expect(environments.python3!.entryPoint).toBe(true);
    expect(environments.python3!.successExitCodes).toBe(true);
    expect(environments.python3!.extraFiles).toBe(true);
    expect(environments.python3!.jarFiles).toBe(false);
    expect(environments.python3!.compileArgs).toBe(false);

    // Java's own pipelines declare no entry point, but they do take jar files at compilation.
    expect(environments.java!.entryPoint).toBe(false);
    expect(environments.java!.jarFiles).toBe(true);
    expect(environments.java!.successExitCodes).toBe(true);
  });

  it("reports an environment the instance has no pipeline for", () => {
    const { withoutPipelines } = configCapabilities(["python3", "rust"], PIPELINES);
    expect(withoutPipelines).toEqual(["rust"]);
  });

  it("knows whether comparing a produced file is possible at all", () => {
    expect(configCapabilities(["python3"], PIPELINES).canCompareFile).toBe(true);
    expect(configCapabilities(["java"], PIPELINES).canCompareFile).toBe(false);
  });

  it("asks for an expected output only where a pipeline declares one", () => {
    // The instance's own pipelines, as core-api lists them: the Python ones hand `expected-output`
    // to their judge, the data-only one does not -- which is why an exercise that collects
    // documents saves with every file field empty and a Python one does not.
    const declared = [
      { id: "python-stdout", pipeline: { variables: [{ name: "expected-output" }] } },
      { id: "data-only", pipeline: { variables: [{ name: "judge-type" }] } },
    ];
    const pipelines = [
      {
        id: "python-stdout",
        name: "Python execution & evaluation [stdout]",
        runtimeEnvironmentIds: ["python3"],
        parameters: {},
      },
      {
        id: "data-only",
        name: "Data-only judging",
        runtimeEnvironmentIds: ["data-linux"],
        parameters: {},
      },
    ];
    expect(configCapabilities(["python3"], pipelines, declared).needsExpectedOutput).toBe(true);
    expect(configCapabilities(["data-linux"], pipelines, declared).needsExpectedOutput).toBe(false);
    // Nothing declared (the argument is optional) must not invent a requirement.
    expect(configCapabilities(["python3"], pipelines).needsExpectedOutput).toBe(false);
  });
});
