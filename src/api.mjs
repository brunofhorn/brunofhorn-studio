// Cliente das rotas do worker na API (`/v1/studio/worker/*`), autenticado pelo token do worker.

import { readFile } from 'node:fs/promises';

export class StudioApi {
  constructor(baseUrl, token) {
    this.base = `${baseUrl.replace(/\/+$/, '')}/v1/studio/worker`;
    this.token = token;
  }

  async #post(path, body) {
    const response = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body && { 'content-type': 'application/json' }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error?.message ?? `API respondeu ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  /** Próximo conteúdo da fila, ou `null`. */
  async claim() {
    return (await this.#post('/claim')).job;
  }

  /**
   * Envia os arquivos ao storage e devolve o que a API precisa para fechar o job.
   * @param {{ name: string, path: string, contentType: string, width: number, height: number, role: string }[]} files
   */
  async upload(job, files) {
    const { data } = await this.#post(`/jobs/${job.contentId}/uploads`, {
      version: job.version,
      files: files.map(({ name, contentType }) => ({ name, contentType })),
    });
    const done = [];
    for (const file of files) {
      const target = data.find((item) => item.name === file.name);
      const body = await readFile(file.path);
      const response = await fetch(target.upload.url, {
        method: target.upload.method,
        headers: target.upload.headers,
        body,
        signal: AbortSignal.timeout(10 * 60_000),
      });
      if (!response.ok) throw new Error(`O storage recusou ${file.name} (${response.status})`);
      done.push({
        key: target.key,
        contentType: file.contentType,
        width: file.width,
        height: file.height,
        role: file.role,
      });
    }
    return done;
  }

  complete(job, files) {
    return this.#post(`/jobs/${job.contentId}/complete`, { version: job.version, files });
  }

  fail(job, error) {
    return this.#post(`/jobs/${job.contentId}/fail`, {
      version: job.version,
      error: String(error).slice(0, 1000),
    });
  }
}
