import { Entry } from 'webpack';
import { expect } from 'chai';
import path from 'path';

import WebpackConfigGenerator from '../src/WebpackConfig';
import { WebpackPluginConfig, WebpackPluginEntryPoint } from '../src/Config';

const mockProjectDir = process.platform === 'win32' ? 'C:\\path' : '/path';

describe('WebpackConfigGenerator', () => {
  describe('getDefines', () => {
    it('throws an error if renderer.entryPoints does not exist', () => {
      const config = {
        renderer: {},
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, '/', false, 3000);
      expect(() => generator.getDefines()).to.throw(/renderer.entryPoints.* has not been defined/);
    });

    it('throws an error if renderer.entryPoints is not an array', () => {
      const config = {
        renderer: {
          entryPoints: {},
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, '/', false, 3000);
      expect(() => generator.getDefines()).to.throw(/renderer.entryPoints.* has not been defined/);
    });

    it('sets the renderer entry point to a JS file in development', () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'hello',
            js: 'foo.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, '/', false, 3000);
      const defines = generator.getDefines();

      expect(defines.HELLO_WEBPACK_ENTRY).to.equal("'http://localhost:3000/hello/index.js'");
    });

    it('sets the renderer entry point to a JS file in production', () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'hello',
            js: 'foo.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, '/', true, 3000);
      const defines = generator.getDefines(false);

      // eslint-disable-next-line no-template-curly-in-string
      expect(defines.HELLO_WEBPACK_ENTRY).to.equal("`file://${require('path').resolve(__dirname, '..', '.', 'hello', 'index.js')}`");
    });

    it('sets the renderer entry point to an HTML file if both an HTML & JS file are specified', () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'hello',
            html: 'foo.html',
            js: 'foo.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, '/', false, 3000);
      const defines = generator.getDefines();

      expect(defines.HELLO_WEBPACK_ENTRY).to.equal("'http://localhost:3000/hello'");
    });

    describe('PRELOAD_WEBPACK_ENTRY', () => {
      const config = {
        mainConfig: {},
        renderer: {
          config: {},
          entryPoints: [
            {
              js: 'window.js',
              name: 'window',
              preload: {
                js: 'preload.js',
              },
            },
          ],
        },
      };

      it('should assign absolute preload script path in development', () => {
        const generator = new WebpackConfigGenerator(config, mockProjectDir, false, 3000);
        const defines = generator.getDefines();

        if (process.platform === 'win32') {
          expect(defines.WINDOW_PRELOAD_WEBPACK_ENTRY).to.equal(String.raw`'C:\\path\\.webpack\\renderer\\window\\preload.js'`);
        } else {
          expect(defines.WINDOW_PRELOAD_WEBPACK_ENTRY).to.equal(`'${mockProjectDir}/.webpack/renderer/window/preload.js'`);
        }
      });

      it('should assign an expression to resolve the preload script in production', () => {
        const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
        const defines = generator.getDefines();
        expect(defines.WINDOW_PRELOAD_WEBPACK_ENTRY).to.equal("require('path').resolve(__dirname, '../renderer', 'window', 'preload.js')");
      });
    });
  });

  describe('getMainConfig', () => {
    it('fails when there is no mainConfig.entry', () => {
      const config = {
        mainConfig: {},
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, '/', false, 3000);
      expect(() => generator.getMainConfig()).to.throw('Required option "mainConfig.entry" has not been defined');
    });

    it('generates a development config', async () => {
      const config = {
        mainConfig: {
          entry: 'main.js',
        },
        renderer: {
          entryPoints: [] as WebpackPluginEntryPoint[],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, false, 3000);
      const webpackConfig = await generator.getMainConfig();
      expect(webpackConfig.target).to.equal('electron-main');
      expect(webpackConfig.mode).to.equal('development');
      expect(webpackConfig.entry).to.equal('main.js');
      expect(webpackConfig.output).to.deep.equal({
        path: path.join(mockProjectDir, '.webpack', 'main'),
        filename: 'index.js',
        libraryTarget: 'commonjs2',
      });
    });

    it('generates a production config', async () => {
      const config = {
        mainConfig: {
          entry: 'main.js',
        },
        renderer: {
          entryPoints: [] as WebpackPluginEntryPoint[],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const webpackConfig = await generator.getMainConfig();
      expect(webpackConfig.mode).to.equal('production');
    });

    it('generates a config with a relative entry path', async () => {
      const config = {
        mainConfig: {
          entry: './foo/main.js',
        },
        renderer: {
          entryPoints: [] as WebpackPluginEntryPoint[],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const webpackConfig = await generator.getMainConfig();
      expect(webpackConfig.entry).to.equal(path.join(mockProjectDir, 'foo', 'main.js'));
    });

    it('generates a config with multiple entries', async () => {
      const config = {
        mainConfig: {
          entry: {
            foo: './foo/main.js',
            bar: 'bar.js',
          } as Entry,
        },
        renderer: {
          entryPoints: [] as WebpackPluginEntryPoint[],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const webpackConfig = await generator.getMainConfig();
      expect(webpackConfig.entry).to.deep.equal({
        foo: path.join(mockProjectDir, 'foo', 'main.js'),
        bar: 'bar.js',
      });
    });

    it('generates a config from a requirable file', async () => {
      const config = {
        mainConfig: 'mainConfig.js',
        renderer: {
          entryPoints: [] as WebpackPluginEntryPoint[],
        },
      } as WebpackPluginConfig;
      const baseDir = path.resolve(__dirname, 'fixtures/main_config_external');
      const generator = new WebpackConfigGenerator(config, baseDir, true, 3000);
      const webpackConfig = await generator.getMainConfig();
      expect(webpackConfig.entry).to.equal(path.resolve(baseDir, 'foo/main.js'));
    });
  });

  describe('getPreloadRendererConfig', () => {
    it('generates a development config', async () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'main',
            preload: {
              js: 'preloadScript.js',
            },
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, false, 3000);
      const entryPoint = config.renderer.entryPoints[0];
      const webpackConfig = await generator.getPreloadRendererConfig(
        entryPoint,
        entryPoint.preload!,
      );
      expect(webpackConfig.target).to.equal('electron-preload');
      expect(webpackConfig.mode).to.equal('development');
      expect(webpackConfig.entry).to.deep.equal(['preloadScript.js']);
      expect(webpackConfig.output).to.deep.equal({
        path: path.join(mockProjectDir, '.webpack', 'renderer', 'main'),
        filename: 'preload.js',
      });
    });
    it('generates a production config', async () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'main',
            preload: {
              js: 'preloadScript.js',
            },
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const entryPoint = config.renderer.entryPoints[0];
      const webpackConfig = await generator.getPreloadRendererConfig(
        entryPoint,
        entryPoint.preload!,
      );
      expect(webpackConfig.target).to.equal('electron-preload');
      expect(webpackConfig.mode).to.equal('production');
      expect(webpackConfig.entry).to.deep.equal(['preloadScript.js']);
      expect(webpackConfig.output).to.deep.equal({
        path: path.join(mockProjectDir, '.webpack', 'renderer', 'main'),
        filename: 'preload.js',
      });
    });
    it('generates config overriding custom target with \'electron-preload\'', async () => {
      const config = {
        renderer: {
          config: {
            target: 'web',
          },
          entryPoints: [{
            name: 'main',
            preload: {
              js: 'preloadScript.js',
            },
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const entryPoint = config.renderer.entryPoints[0];
      const webpackConfig = await generator.getPreloadRendererConfig(
        entryPoint,
        entryPoint.preload!,
      );
      expect(webpackConfig.target).to.equal('electron-preload');
      expect(webpackConfig.mode).to.equal('production');
      expect(webpackConfig.entry).to.deep.equal(['preloadScript.js']);
      expect(webpackConfig.output).to.deep.equal({
        path: path.join(mockProjectDir, '.webpack', 'renderer', 'main'),
        filename: 'preload.js',
      });
    });
  });

  describe('getRendererConfig', () => {
    it('generates a development config', async () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'main',
            js: 'rendererScript.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, false, 3000);
      const webpackConfig = await generator.getRendererConfig(config.renderer.entryPoints);
      expect(webpackConfig.target).to.equal('electron-renderer');
      expect(webpackConfig.mode).to.equal('development');
      expect(webpackConfig.entry).to.deep.equal({
        main: ['rendererScript.js'],
      });
      expect(webpackConfig.output).to.deep.equal({
        path: path.join(mockProjectDir, '.webpack', 'renderer'),
        filename: '[name]/index.js',
        globalObject: 'self',
        publicPath: '/',
      });
      expect(webpackConfig.plugins!.length).to.equal(2);
    });

    it('generates a development config with an HTML endpoint', async () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'main',
            html: 'renderer.html',
            js: 'rendererScript.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, false, 3000);
      const webpackConfig = await generator.getRendererConfig(config.renderer.entryPoints);
      expect(webpackConfig.entry).to.deep.equal({
        main: [
          'rendererScript.js',
          'webpack-hot-middleware/client',
        ],
      });
      expect(webpackConfig.plugins!.length).to.equal(3);
    });

    it('generates a production config', async () => {
      const config = {
        renderer: {
          entryPoints: [{
            name: 'main',
            js: 'rendererScript.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const webpackConfig = await generator.getRendererConfig(config.renderer.entryPoints);
      expect(webpackConfig.target).to.equal('electron-renderer');
      expect(webpackConfig.mode).to.equal('production');
      expect(webpackConfig.entry).to.deep.equal({
        main: ['rendererScript.js'],
      });
      expect(webpackConfig.output).to.deep.equal({
        path: path.join(mockProjectDir, '.webpack', 'renderer'),
        filename: '[name]/index.js',
        globalObject: 'self',
      });
      expect(webpackConfig.plugins!.length).to.equal(1);
    });

    it('generates config with custom target - web', async () => {
      const config = {
        renderer: {
          config: {
            target: 'web',
          },
          entryPoints: [{
            name: 'main',
            js: 'rendererScript.js',
          }],
        },
      } as WebpackPluginConfig;
      const generator = new WebpackConfigGenerator(config, mockProjectDir, true, 3000);
      const webpackConfig = await generator.getRendererConfig(config.renderer.entryPoints);
      expect(webpackConfig.target).to.equal('web');
      expect(webpackConfig.mode).to.equal('production');
      expect(webpackConfig.entry).to.deep.equal({
        main: ['rendererScript.js'],
      });
    });
  });
});
