
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'node:path';

// Define mock functions
const mockExistsSync = jest.fn();
const mockReadFile = jest.fn();
const mockEnvPaths = jest.fn<(name: string) => { config: string; data: string; cache: string }>();
const mockPlatform = jest.fn();
const mockHomedir = jest.fn();

// Register mocks before importing the module
jest.unstable_mockModule('node:fs', () => {
    const actual = jest.requireActual('node:fs') as any;
    return {
        ...actual,
        existsSync: mockExistsSync,
        readFile: mockReadFile,
    };
});

jest.unstable_mockModule('env-paths', () => ({
    default: mockEnvPaths,
}));

jest.unstable_mockModule('node:os', () => {
    const actual = jest.requireActual('node:os') as any;
    return {
        ...actual,
        default: {
            ...actual.default,
            platform: mockPlatform,
            homedir: mockHomedir,
        },
        platform: mockPlatform,
        homedir: mockHomedir,
    };
});

// Dynamic import of the module under test
const { getConfigPath } = await import('./index.js');

describe('getConfigPath', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.XDG_CONFIG_HOME = '';

        // Default mock implementations
        mockPlatform.mockReturnValue('linux');
        mockHomedir.mockReturnValue('/home/user');
        mockExistsSync.mockReturnValue(false);

        // Setup env-paths mock return
        mockEnvPaths.mockImplementation((name: string) => ({
            config: `/mock/platform/config/${name}`,
            data: `/mock/platform/data/${name}`,
            cache: `/mock/platform/cache/${name}`,
        }));
    });

    afterEach(() => {
        delete process.env.XDG_CONFIG_HOME;
    });

    it('should prioritize XDG_CONFIG_HOME if set and exists', () => {
        process.env.XDG_CONFIG_HOME = '/custom/config';
        mockExistsSync.mockImplementation((p: any) => p === path.join('/custom/config/runr/config.yml'));

        const result = getConfigPath();
        expect(result).toBe(path.join('/custom/config/runr/config.yml'));
    });

    it('should use ~/.config/runr/config.yml on Linux/Mac if exists', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExistsSync.mockImplementation((p: any) => p === path.join('/home/user/.config/runr/config.yml'));

        const result = getConfigPath();
        expect(result).toBe(path.join('/home/user/.config/runr/config.yml'));
    });

    it('should fall back to platform default (env-paths) if ~/.config does not exist', () => {
        mockPlatform.mockReturnValue('darwin');
        // Mock platform path existence
        mockExistsSync.mockImplementation((p: any) => p === '/mock/platform/config/runr/config.yml');

        const result = getConfigPath();
        expect(result).toBe('/mock/platform/config/runr/config.yml');
    });

    it('should fall back to legacy ./config.yml if nothing else matches', () => {
        const result = getConfigPath();
        expect(result).toBe('./config.yml');
    });
});
