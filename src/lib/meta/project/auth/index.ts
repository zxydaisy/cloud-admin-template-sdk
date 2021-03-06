import * as path from 'path';
import File from '../../common/file';
import { ProjectPath, LEVEL_ENUM } from '../../common';
import Tree from '../../common/tree';
import type Project from '..';
export default class Auth extends Tree implements ProjectPath{
    private fileOP: File;
    constructor(root: string, parent: Project) {
        super('auth', root, LEVEL_ENUM.auth, parent);
        this.fileOP = new File(this.fullPath, {
            willCreate: true,
            defaultContent: JSON.stringify({}),
        });
    }
    getFullPath(): string {
        return path.join(this.root, '.vusion/auth-cache.json');
    }
    public load(): string {
        return this.fileOP.loadJSON();
    }
    public removeItem(name: string): ReturnType<File["remove"]> {
        const json = this.fileOP.loadJSON();
        delete json[name];
        return this.fileOP.save(json);
    }
    public addItem(name: string): ReturnType<File["save"]> {
        const json = this.fileOP.loadJSONOrCreate({});
        json[name] = true;
        return this.fileOP.save(json);
    }
}