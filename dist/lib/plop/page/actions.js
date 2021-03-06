"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const utils_1 = require("../../utils");
const ms = __importStar(require("vusion-api/out/ms"));
const pages_1 = __importDefault(require("./pages"));
exports.default = {
    add(pageInfo, root) {
        const { name, title, template, auth, isIndex } = pageInfo;
        const dest = path.join(root, './src/views', pageInfo.name);
        const base = path.join(__dirname, '../../../../template/page');
        return [
            function () {
                if (!name) {
                    throw new Error('name 为空');
                }
                else {
                    const pages = pages_1.default.get(root);
                    if (pages[name]) {
                        throw new Error('该页面已经存在！');
                    }
                    if (isIndex) {
                        Object.keys(pages).forEach((pageName) => {
                            const page = pages[pageName];
                            if (page.options && page.options.isIndex) {
                                page.options.isIndex = false;
                            }
                        });
                    }
                    pages[name] = {
                        entry: `./src/views/${name}/index.js`,
                        template: `./src/pages/${name}.html`,
                        filename: `${name}.html`,
                        favicon: './src/pages/favicon.ico',
                        title,
                        inject: true,
                        chunks: [
                            'chunk-vendors',
                            name,
                        ],
                        chunksSortMode: 'manual',
                        options: {
                            auth,
                            isIndex,
                        },
                    };
                    pages_1.default.set(root, pages);
                }
            },
            {
                type: 'addMany',
                destination: utils_1.fixSlash(dest),
                base: utils_1.fixSlash(path.join(base, 'src')),
                templateFiles: utils_1.fixSlash(path.join(base, 'src/**')),
            },
            {
                type: 'add',
                path: path.join(root, './src/pages', name + '.html'),
                base,
                templateFile: path.join(base, 'index.html'),
            },
            function () {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!template) {
                        return;
                    }
                    let content = '';
                    const packageName = `@cloud-ui/s-${template}.vue`;
                    const blockCacheDir = ms.getCacheDir('blocks');
                    const blockPath = yield ms.download.npm({
                        registry: 'https://registry.npmjs.org',
                        name: packageName,
                    }, blockCacheDir);
                    content = yield fs.readFile(path.join(blockPath, 'index.vue'), 'utf8');
                    yield fs.writeFile(path.join(dest, 'views/index.vue'), content);
                    const pkgInfo = JSON.parse(yield fs.readFile(path.join(blockPath, 'package.json'), 'utf8'));
                    const deps = pkgInfo.vusionDependencies;
                    if (deps && Object.keys(deps).length) {
                        yield Promise.all(Object.keys(deps).map((name) => ms.install({
                            name,
                            version: deps[name].replace(/^[^\d]+/, ''),
                        })));
                    }
                });
            },
        ];
    },
    remove(pageInfo, root) {
        const { name } = pageInfo;
        const viewsRoot = path.join(root, './src/views');
        const dest = path.join(viewsRoot, name);
        return [
            function () {
                fs.removeSync(dest);
                fs.removeSync(path.join(root, './src/pages', name + '.html'));
                const pages = pages_1.default.get(root);
                delete pages[name];
                pages_1.default.set(root, pages);
            },
        ];
    }
};
