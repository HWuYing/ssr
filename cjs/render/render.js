"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Render = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const module_1 = require("module");
const vm_1 = tslib_1.__importDefault(require("vm"));
class Render {
    entryFile;
    microName;
    _compiledRender;
    resource;
    vmContext;
    isDevelopment = process.env.NODE_ENV === 'development';
    constructor(entryFile, options) {
        this.entryFile = entryFile;
        const { resource, microName = '', vmContext = {} } = options;
        this.resource = resource;
        this.microName = microName;
        this.vmContext = vmContext;
    }
    factoryVmScript() {
        const registryRender = (render) => this._compiledRender = render;
        const m = { exports: {}, require: (0, module_1.createRequire)(this.entryFile) };
        const wrapper = module_1.Module.wrap(fs_1.default.readFileSync(this.entryFile, 'utf-8'));
        const script = new vm_1.default.Script(wrapper, { filename: 'server-entry.js', displayErrors: true });
        const timerContext = { setTimeout, setInterval, clearInterval, clearTimeout };
        const vmContext = { Buffer, process, console, registryRender, ...timerContext, ...this.vmContext };
        const compiledWrapper = script.runInContext(vm_1.default.createContext(vmContext));
        compiledWrapper(m.exports, m.require, m);
    }
    async _render(request, isMicro) {
        try {
            if (this.isDevelopment || !this._compiledRender) {
                this.factoryVmScript();
            }
            return await this._compiledRender({ resource: this.resource, request }, isMicro);
        }
        catch (e) {
            console.log(e);
            return { html: e.message, styles: '' };
        }
    }
    createScriptTemplate(scriptId, insertInfo) {
        const evalFun = `(function(){ const script = document.querySelector('#${scriptId}');script.parentNode.removeChild(script);}());`;
        return `<script id="${scriptId}">${insertInfo}${evalFun}</script>`;
    }
    async renderMicro(request) {
        const { html, styles, links, fetchData, microTags, microFetchData = [] } = await this._render(request, true);
        microFetchData.push({ microName: this.microName, source: fetchData });
        return { html, styles, links, microTags, microFetchData };
    }
    async render(request) {
        const { js = [], links = [], html, styles, fetchData, microTags = [], microFetchData = [] } = await this._render(request);
        const _fetchData = this.createScriptTemplate('fetch-static', `var fetchCacheData = ${fetchData};`);
        const microData = this.createScriptTemplate('micro-fetch-static', `var microFetchData = ${JSON.stringify(microFetchData)};`);
        const chunkCss = this.isDevelopment ? links : this.resource.readAssetsSync()['chunk']?.css || [];
        const chunkLinks = chunkCss.map((href) => `<link href="${href}" rel="stylesheet">`).join('');
        let headContent = `${chunkLinks}${styles}${_fetchData}${microData}${microTags.join('')}`;
        if (this.isDevelopment) {
            headContent += js.map((src) => `<script defer src="${src}"></script>`).join('');
        }
        return this.resource.generateHtmlTemplate()
            .replace(this.resource.innerHtmlFlag, html)
            .replace(this.resource.innerHeadFlag, headContent);
    }
}
exports.Render = Render;
