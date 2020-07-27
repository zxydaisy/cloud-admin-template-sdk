
import * as fs from 'fs';
import { project } from '../global';
describe('View', () => {
    
    test('init', async () => {
        await project.page.add({
            name: 'viewTest',
            title: 'fff',
        });
        expect(true).toBe(true);
    });
    test('add view', () => {
        const page = project.page.load('viewTest');
        page.view.add('a/b');
        expect(page.view.load('a/b').exists()).toBe(true);
    });
    test('remove view', async () => {
        const page = project.page.load('viewTest');
        page.view.remove('a/b');
        expect(page.view.load('a/b').exists()).toBe(false);
        await project.page.remove({
            name: 'viewTest',
        });
    });
    
});