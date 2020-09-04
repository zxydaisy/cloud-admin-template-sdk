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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const metaData_1 = __importDefault(require("./metaData"));
const utils_1 = __importDefault(require("../utils"));
const Tree_1 = __importDefault(require("../common/Tree"));
const Directory_1 = __importDefault(require("../common/Directory"));
const common_1 = require("../common");
const routes_1 = __importDefault(require("../routes"));
const view_1 = __importDefault(require("./view"));
class Page extends Tree_1.default {
    constructor(name, root, parent) {
        super(name, root, common_1.LEVEL_ENUM.page, parent);
        this.metaData = new metaData_1.default(parent.clientPath, name);
        this.routes = new routes_1.default(this.fullPath);
        this.view = view_1.default(this.fullPath, this);
    }
    getFullPath() {
        return path.join(this.root, this.name);
    }
    static add(answers, config) {
        const plop = utils_1.default.getPlop(config);
        return plop.getGenerator('page.add').runActions(answers);
    }
    static remove(answers, config) {
        const plop = utils_1.default.getPlop(config);
        return plop.getGenerator('page.remove').runActions(answers);
    }
}
exports.default = Page;
Page.getPagesPath = function (root) {
    return new Directory_1.default(root).dir();
};
