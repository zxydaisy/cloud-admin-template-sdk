import * as path from 'path';
import Tree from '../common/tree';
import File from '../common/file';
import { ProjectPath, LEVEL_ENUM } from '../common';
import type Page from '../page';
import Directory from '../common/directory';
import { templatePath } from '../../utils';
export type ViewOptions = {
    title: string;
    template?: string;
};
export default class View extends Tree implements ProjectPath{

    public file: File;
    constructor(name: string, root: string, parent: Page) {
        super(name, root, LEVEL_ENUM.view, parent);
        this.file = new File(this.fullPath);
    }

    static getFullPath = function (root: string, name: string): string {
        return path.join(root, name, 'index.vue');
    }

    static getViewsPath = function(root: string): string[] {
        const dirOP = new Directory(root);
        return dirOP.dirAll().filter((item) => {
            return item.endsWith('index.vue');
        }).map((item) => '/' + item.trim().replace('index.vue', '').replace(/\/$/, ''));
    }

    public getFullPath(): string {
        return View.getFullPath(this.root, this.name);
    }

    public getContent(): string {
        return this.file.load();
    }

    static removeView(root: string, name: string): ReturnType<File["remove"]> {
        const file = new File(View.getFullPath(root, name));
        if (!file.exists()) {
            throw new Error(`file is not exist`);
        }
        return file.remove();
    }
    static addView(root: string, name: string, options: ViewOptions): ReturnType<File["save"]> {
        const file = new File(View.getFullPath(root, name));
        if (file.exists()) {
            throw new Error(`file is exist`);
        }
        const templateFile = new File(path.join(templatePath, 'view/index.vue'));
        return file.save(templateFile.load());
    }
}