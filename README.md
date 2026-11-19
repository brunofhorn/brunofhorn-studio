# brunofhorn-studio

Worker que renderiza os conteúdos do **Estúdio** (menu _Perfis_ do admin). A API escreve o
conteúdo com a IA e põe na fila; este worker pega a fila, gera a mídia e devolve:

| Formato           | Como renderiza                                                                  | Saída                    |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Post e carrossel  | Abre o HTML dos slides (template da skill `carrossel`, montado pela API) no Chromium e fotografa cada `.slide` | JPG 1080x1350 por slide |
| Reel              | Template Remotion da skill `reel` ([reel/](reel/)) com o `cenas.json` que a API montou | MP4 1080x1920 + capa JPG |

Os arquivos vão direto para o bucket público do R2 por URL temporária; a API só autoriza.

## Rodar

Node 20.19+ e, para a trilha dos reels, ffmpeg no PATH.

```bash
npm install
npm run setup          # Chromium do Playwright e o navegador do Remotion (uma vez)
cp .env.example .env   # STUDIO_API_URL e o mesmo STUDIO_WORKER_TOKEN da API
npm start              # fica escutando a fila (Ctrl+C termina depois do job atual)
npm run once           # renderiza o que estiver na fila e sai
```

Pode rodar no PC (só renderiza enquanto estiver ligado; agendar e publicar continuam na API)
ou num servidor, com o [Dockerfile](Dockerfile) (ex.: um segundo serviço na Railway com
`STUDIO_API_URL` e `STUDIO_WORKER_TOKEN`). Mais de um worker pode rodar ao mesmo tempo: a
API reserva cada job para um só.

## Áudio dos reels

Segue a identidade do perfil (admin › Perfis › Briefing e marca):

- **Efeitos e trilha**: sintetizados por [scripts/gerar-audio.mjs](scripts/gerar-audio.mjs)
  (originais, sem licença a respeitar) e nivelados por `mixar.mjs` (precisa do ffmpeg).
- **Narração**: quando o conteúdo pede, `narrar.mjs` usa o ElevenLabs com a
  `ELEVENLABS_API_KEY` deste worker e a voz do perfil (ou `ELEVENLABS_VOICE_ID`). Sem chave, o
  reel sai sem voz, com a legenda animada.

`scripts/` e `reel/` são cópias da skill `reel`. Ao atualizar a skill, copie de novo
`template/src` para `reel/src` e os scripts para `scripts/`.

## Dicas

- Para mexer no visual do reel: `npm run studio` abre o Remotion Studio com `reel/cenas.json`.
- No Windows, o ponto de entrada do Remotion vai explícito (`reel/src/index.ts`): sem ele, o
  nome da composição `Reel` casa com a pasta `reel/` e o bundle falha com `EISDIR`.
