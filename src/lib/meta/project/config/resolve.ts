import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import File from '../../common/file';
// import chokidar from 'chokidar';
import getDefaults, { VusionConfig, Theme } from './getDefaults';

const TYPES = ['library', 'app', 'html5', 'fullstack', 'component', 'block', 'template', 'repository'];

function getConfig(cwd: string, configPath: string, packagePath: string): any {
    delete require.cache[configPath];
    delete require.cache[packagePath];
    if (fs.existsSync(configPath))
        return require(configPath);
    else if (fs.existsSync(packagePath)) {
        const packageVusion = require(packagePath).vusion;
        if (packageVusion)
            return packageVusion;
        else {
            throw new Error(chalk.bgRed(' ERROR ') + ` Cannot find vusion config! This is not a vusion project.
    processCwd: ${cwd}
    configPath: ${configPath}
`);

        }
    }
}

interface CLIArgs {
    'vusion-mode'?: string;
    'base-css'?: string;
    theme?: string;
    'apply-theme'?: boolean;
    'output-path'?: string;
    'public-path'?: string;
    'static-path'?: string;
    'src-path'?: string;
    'library-path'?: string;
}

export default function resolve(cwd: string, configPath = 'vusion.config.js', args?: CLIArgs, throwErrors?: boolean): VusionConfig {
    cwd = cwd || process.cwd();

    const config = getDefaults();

    const packagePath = config.packagePath = path.resolve(cwd, 'package.json');
    configPath = config.configPath = path.resolve(cwd, configPath);
    const userConfig = getConfig(cwd, configPath, packagePath);

    // 覆盖一些默认配置
    if (userConfig.type === 'library') {
        config.publicPath = './';
        config.outputPath = 'dist';
    }

    Object.assign(config, userConfig);

    if (!TYPES.includes(config.type)) {
        throw new Error(chalk.bgRed(' ERROR ') + ' Unknown project type!');
    }

    /**
     * CLI Arguments
     */
    if (args) {
        if (args['vusion-mode'])
            config.mode = args['vusion-mode'];
        if (args.theme)
            config.theme = args.theme;
        if (args['apply-theme'] !== undefined)
            config.applyTheme = !!args['apply-theme'];
        if (args['base-css'])
            config.baseCSSPath = path.resolve(cwd, args['base-css']);
        if (args['output-path'])
            config.outputPath = path.resolve(cwd, args['output-path']);
        if (args['public-path'])
            config.publicPath = path.resolve(cwd, args['public-path']);
        if (args['src-path'])
            config.srcPath = path.resolve(cwd, args['src-path']);
        if (args['library-path'])
            config.libraryPath = path.resolve(cwd, args['library-path']);
    }

    config.srcPath = path.resolve(cwd, config.srcPath || './src');
    config.libraryPath = path.resolve(cwd, config.libraryPath || config.srcPath);
    if (config.type === 'library') {
        config.docs = config.docs || {};
    } else if (config.type === 'component' || config.type === 'block') {
        config.srcPath = cwd;
        const pkg = new File(packagePath).loadJSON();
        let libraryName = pkg.vusion.ui;
        if (!libraryName && pkg.peerDependencies)
            libraryName = Object.keys(pkg.peerDependencies).find((key) => key.endsWith('.vusion'));
        if (!libraryName)
            libraryName = 'cloud-ui.vusion';
        config.libraryPath = path.dirname(require.resolve(`${libraryName}/src`));
    }

    let themeAutoDetected = false;
    if (!config.theme) {
        themeAutoDetected = true;
        config.theme = {
            default: path.resolve(config.libraryPath, './styles/theme.css'),
        };
    }
    if (typeof config.theme === 'string') {
        config.theme = config.theme.split(',');
    }
    if (Array.isArray(config.theme)) {
        const theme: Theme = {};

        config.theme.forEach((_theme) => {
            if (_theme.endsWith('.css')) { // is a path
                let name = path.basename(_theme, '.css');
                if (name === 'theme')
                    name = 'default';
                theme[name] = path.resolve(cwd, _theme);
            } else { // is a name
                if (_theme === 'default' || _theme === 'theme')
                    theme['default'] = path.resolve(config.libraryPath, './styles/theme.css');
                else
                    theme[_theme] = path.resolve(cwd, `./themes/${_theme}.css`);
            }
        });

        config.theme = theme;
    }
    // else Object

    if (themeAutoDetected) {
        // @compat old version
        if (!fs.existsSync((config.theme as Theme).default))
            (config.theme as Theme).default = path.resolve(config.libraryPath, './base/global.css');

        if (!fs.existsSync((config.theme as Theme).default)) {
            try {
                (config.theme as Theme).default = path.resolve(require.resolve('@vusion/doc-loader'), '../node_modules/proto-ui.vusion/src/styles/theme.css');
            } catch(e) {
                // not work
            }

        }
    }

    let baseCSSPath; // 用于保存非文档的 baseCSSPath 路径
    if (!config.baseCSSPath) {
        baseCSSPath = config.baseCSSPath = path.resolve(config.libraryPath, './styles/base.css');

        // @compat old version
        if (!fs.existsSync(config.baseCSSPath))
            baseCSSPath = config.baseCSSPath = path.resolve(config.libraryPath, './base/base.css');

        if (!fs.existsSync(config.baseCSSPath)) {
            try {
                config.baseCSSPath = path.resolve(require.resolve('@vusion/doc-loader'), '../node_modules/proto-ui.vusion/src/styles/base.css');
            } catch(e) {
                // not work
            }
        }
    } else
       config.baseCSSPath = baseCSSPath = path.resolve(cwd, config.baseCSSPath);
    if (!fs.existsSync(config.baseCSSPath) && throwErrors)
        throw new Error(`Cannot find baseCSSPath: ${baseCSSPath}`);

    if (config.designer) {
        config.designer = Object.assign({
            protocol: 'http',
            host: 'localhost',
            port: 12800,
        }, config.designer);
    }

    return config;
}
