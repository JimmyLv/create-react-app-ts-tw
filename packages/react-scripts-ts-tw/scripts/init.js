// @remove-file-on-eject
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const spawn = require('react-dev-utils/crossSpawn');

module.exports = function(
  appPath,
  appName,
  verbose,
  originalDirectory,
  template
) {
  const ownPackageName = require(path.join(
    __dirname,
    '..',
    'package.json'
  )).name;
  const ownPath = path.join(appPath, 'node_modules', ownPackageName);
  const appPackage = require(path.join(appPath, 'package.json'));
  const useYarn = fs.existsSync(path.join(appPath, 'yarn.lock'));
console.log('parameters----:', appPath, originalDirectory, template)
  // Copy over some of the devDependencies
  appPackage.dependencies = Object.assign({
    '@types/jest': '^20.0.1',
    '@types/node': '^8.0.1',
    '@types/react': '^15.0.31',
    '@types/react-dom': '^15.5.0',
    '@types/react-redux': '^4.4.45',
    '@types/react-router': '^4.0.12',
    '@types/react-router-redux': '^5.0.3',
    '@types/redux-storage': '^4.0.7',
    'history': '^4.6.0',
    'isomorphic-fetch': '^2.2.1',
    'most': '^1.4.1',
    'react': '^15.6.1',
    'react-dom': '^15.6.1',
    'react-redux': '^5.0.5',
    'react-router': '^4.1.1',
    'react-router-redux': '^5.0.0-alpha.6',
    'redux': '^3.7.0',
    'redux-logger': '^3.0.6',
    'redux-most': '^0.5.2',
    'redux-storage': '^4.1.2',
    'redux-storage-decorator-filter': '^1.1.8',
    'redux-storage-engine-localstorage': '^1.1.4',
    'redux-thunk': '^2.2.0'
  }, appPackage.dependencies);

  appPackage.devDependencies = Object.assign({
    '@types/enzyme': '^2.8.1',
    '@types/fetch-mock': '^5.8.3',
    '@types/isomorphic-fetch': '0.0.34',
    'typescript': '2.3.4',
    'enzyme': '^2.9.1',
    'fetch-mock': '^5.12.1',
    'husky': '^0.14.1',
    'react-addons-test-utils': '15.4.2',
  }, appPackage.devDependencies);

  // Setup the script rules
  appPackage.scripts = {
    prepush: 'CI=true npm test',
    start: 'react-scripts-ts-tw start',
    build: 'react-scripts-ts-tw build',
    test: 'react-scripts-ts-tw test --env=jsdom',
    eject: 'react-scripts-ts-tw eject',
  };

  fs.writeFileSync(
    path.join(appPath, 'package.json'),
    JSON.stringify(appPackage, null, 2)
  );

  const readmeExists = fs.existsSync(path.join(appPath, 'README.md'));
  if (readmeExists) {
    fs.renameSync(
      path.join(appPath, 'README.md'),
      path.join(appPath, 'README.old.md')
    );
  }

  // Copy the files for the user
  const templatePath = template
    ? path.resolve(originalDirectory, template)
    : path.join(ownPath, 'template');
  if (fs.existsSync(templatePath)) {
    fs.copySync(templatePath, appPath);
  } else {
    console.error(
      `Could not locate supplied template: ${chalk.green(templatePath)}`
    );
    return;
  }

  // Rename gitignore after the fact to prevent npm from renaming it to .npmignore
  // See: https://github.com/npm/npm/issues/1862
  fs.move(
    path.join(appPath, 'gitignore'),
    path.join(appPath, '.gitignore'),
    [],
    err => {
      if (err) {
        // Append if there's already a `.gitignore` file there
        if (err.code === 'EEXIST') {
          const data = fs.readFileSync(path.join(appPath, 'gitignore'));
          fs.appendFileSync(path.join(appPath, '.gitignore'), data);
          fs.unlinkSync(path.join(appPath, 'gitignore'));
        } else {
          throw err;
        }
      }
    }
  );

  let command;
  let args;

  if (useYarn) {
    command = 'yarnpkg';
    args = [''];
  } else {
    command = 'npm';
    args = ['install', verbose && '--verbose'].filter(e => e);
  }

  // Install additional template dependencies, if present
  const templateDependenciesPath = path.join(
    appPath,
    '.template.dependencies.json'
  );
  if (fs.existsSync(templateDependenciesPath)) {
    const templateDependencies = require(templateDependenciesPath).dependencies;
    args = args.concat(
      Object.keys(templateDependencies).map(key => {
        return `${key}@${templateDependencies[key]}`;
      })
    );
    fs.unlinkSync(templateDependenciesPath);
  }


  console.log(`${command} Installing...`);
  console.log();

  const proc = spawn.sync(command, args, { stdio: 'inherit' });
  if (proc.status !== 0) {
    console.error(`\`${command} ${args.join(' ')}\` failed`);
    return;
  }

  // Install react and react-dom for backward compatibility with old CRA cli
  // which doesn't install react and react-dom along with react-scripts
  // or template is presetend (via --internal-testing-template)
  if (!isReactInstalled(appPackage) || template) {
    console.log(`Installing react and react-dom using ${command}...`);
    console.log();

    const proc = spawn.sync(command, args.concat(['react', 'react-dom']), {
      stdio: 'inherit',
    });
    if (proc.status !== 0) {
      console.error(`\`${command} ${args.join(' ')}\` failed`);
      return;
    }
  }

  // Display the most elegant way to cd.
  // This needs to handle an undefined originalDirectory for
  // backward compatibility with old global-cli's.
  let cdpath;
  if (originalDirectory && path.join(originalDirectory, appName) === appPath) {
    cdpath = appName;
  } else {
    cdpath = appPath;
  }

  // Change displayed command to yarn instead of yarnpkg
  const displayedCommand = useYarn ? 'yarn' : 'npm';

  console.log();
  console.log(`Success! Created ${appName} at ${appPath}`);
  console.log('Inside that directory, you can run several commands:');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} start`));
  console.log('    Starts the development server.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`)
  );
  console.log('    Bundles the app into static files for production.');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} test`));
  console.log('    Starts the test runner.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}eject`)
  );
  console.log(
    '    Removes this tool and copies build dependencies, configuration files'
  );
  console.log(
    '    and scripts into the app directory. If you do this, you can’t go back!'
  );
  console.log();
  console.log('We suggest that you begin by typing:');
  console.log();
  console.log(chalk.cyan('  cd'), cdpath);
  console.log(`  ${chalk.cyan(`${displayedCommand} start`)}`);
  if (readmeExists) {
    console.log();
    console.log(
      chalk.yellow(
        'You had a `README.md` file, we renamed it to `README.old.md`'
      )
    );
  }
  console.log();
  console.log('Happy hacking!');
};

function isReactInstalled(appPackage) {
  const dependencies = appPackage.dependencies || {};

  return typeof dependencies.react !== 'undefined' &&
    typeof dependencies['react-dom'] !== 'undefined';
}
