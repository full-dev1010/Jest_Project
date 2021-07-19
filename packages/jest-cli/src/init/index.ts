/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import chalk = require('chalk');
import * as fs from 'graceful-fs';
import prompts = require('prompts');
import {constants} from 'jest-config';
import {tryRealpath} from 'jest-util';
import {MalformedPackageJsonError, NotFoundPackageJsonError} from './errors';
import generateConfigFile from './generateConfigFile';
import modifyPackageJson from './modifyPackageJson';
import defaultQuestions, {testScriptQuestion} from './questions';
import type {ProjectPackageJson} from './types';

const {
  JEST_CONFIG_BASE_NAME,
  JEST_CONFIG_EXT_MJS,
  JEST_CONFIG_EXT_JS,
  JEST_CONFIG_EXT_TS,
  JEST_CONFIG_EXT_ORDER,
  PACKAGE_JSON,
} = constants;

type PromptsResults = {
  useTypescript: boolean;
  clearMocks: boolean;
  coverage: boolean;
  coverageProvider: boolean;
  environment: boolean;
  scripts: boolean;
};

const getConfigFilename = (ext: string) => JEST_CONFIG_BASE_NAME + ext;

export default async (
  rootDir: string = tryRealpath(process.cwd()),
): Promise<void> => {
  // prerequisite checks
  const projectPackageJsonPath: string = path.join(rootDir, PACKAGE_JSON);

  if (!fs.existsSync(projectPackageJsonPath)) {
    throw new NotFoundPackageJsonError(rootDir);
  }

  const questions = defaultQuestions.slice(0);
  let hasJestProperty: boolean = false;
  let projectPackageJson: ProjectPackageJson;

  try {
    projectPackageJson = JSON.parse(
      fs.readFileSync(projectPackageJsonPath, 'utf-8'),
    );
  } catch {
    throw new MalformedPackageJsonError(projectPackageJsonPath);
  }

  if (projectPackageJson.jest) {
    hasJestProperty = true;
  }

  const existingJestConfigExt = JEST_CONFIG_EXT_ORDER.find(ext =>
    fs.existsSync(path.join(rootDir, getConfigFilename(ext))),
  );

  if (hasJestProperty || existingJestConfigExt) {
    const result: {continue: boolean} = await prompts({
      initial: true,
      message:
        'It seems that you already have a jest configuration, do you want to override it?',
      name: 'continue',
      type: 'confirm',
    });

    if (!result.continue) {
      console.log();
      console.log('Aborting...');
      return;
    }
  }

  // Add test script installation only if needed
  if (
    !projectPackageJson.scripts ||
    projectPackageJson.scripts.test !== 'jest'
  ) {
    questions.unshift(testScriptQuestion);
  }

  // Start the init process
  console.log();
  console.log(
    chalk.underline(
      `The following questions will help Jest to create a suitable configuration for your project\n`,
    ),
  );

  let promptAborted: boolean = false;

  // @ts-expect-error: Return type cannot be object - faulty typings
  const results: PromptsResults = await prompts(questions, {
    onCancel: () => {
      promptAborted = true;
    },
  });

  if (promptAborted) {
    console.log();
    console.log('Aborting...');
    return;
  }

  // Determine if Jest should use JS or TS for the config file
  const jestConfigFileExt = results.useTypescript
    ? JEST_CONFIG_EXT_TS
    : projectPackageJson.type === 'module'
    ? JEST_CONFIG_EXT_MJS
    : JEST_CONFIG_EXT_JS;

  // Determine Jest config path
  const jestConfigPath = existingJestConfigExt
    ? getConfigFilename(existingJestConfigExt)
    : path.join(rootDir, getConfigFilename(jestConfigFileExt));

  const shouldModifyScripts = results.scripts;

  if (shouldModifyScripts || hasJestProperty) {
    const modifiedPackageJson = modifyPackageJson({
      projectPackageJson,
      shouldModifyScripts,
    });

    fs.writeFileSync(projectPackageJsonPath, modifiedPackageJson);

    console.log('');
    console.log(`✏️  Modified ${chalk.cyan(projectPackageJsonPath)}`);
  }

  const generatedConfig = generateConfigFile(
    results,
    projectPackageJson.type === 'module' ||
      jestConfigPath.endsWith(JEST_CONFIG_EXT_MJS),
  );

  fs.writeFileSync(jestConfigPath, generatedConfig);

  console.log('');
  console.log(
    `📝  Configuration file created at ${chalk.cyan(jestConfigPath)}`,
  );
};
