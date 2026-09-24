# Shinobi Online

MMORPG fan-made inspirado em Naruto, com visual retrô em pixel art, combate ARPG em tempo real e suporte a desktop e mobile.

> Projeto de fã, sem fins lucrativos e sem afiliação oficial com Masashi Kishimoto, Shueisha ou detentores da marca Naruto.

## Visão geral

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind/shadcn
- **Game server:** Bun + Socket.IO
- **Banco local:** Prisma + SQLite
- **Gameplay:** mundo 2D, PvE cooperativo, monstros, missões, loja, poções, progressão e bots
- **Controles:** desktop (WASD, mouse e hotkeys) e mobile (joystick e botões touch)

## Estrutura

```text
src/                              # app Next.js e cliente do jogo
src/components/game/              # engine, renderização, input, rede e UI
mini-services/game-server/        # servidor em tempo real Socket.IO
prisma/                           # schema Prisma
 db/custom.db                     # banco SQLite local
examples/websocket/               # exemplos de comunicação
Caddyfile                         # proxy para Next.js + game server
```

## Requisitos

- Bun
- Caddy (recomendado para usar o proxy fornecido)

## Configuração

```bash
cp .env.example .env
bun install
bun run db:generate
bun run db:push
```

Instale também as dependências do servidor do jogo:

```bash
cd mini-services/game-server
bun install
cd ../..
```

## Desenvolvimento

Em um terminal, inicie o frontend:

```bash
bun run dev
```

Em outro terminal, inicie o servidor do jogo:

```bash
cd mini-services/game-server
bun run dev
```

O cliente usa o caminho padrão `/socket.io/`. O `Caddyfile` encaminha esse caminho para o game server em `127.0.0.1:3003` e todo o restante para o Next.js em `127.0.0.1:3000`. Inicie o Caddy e acesse a aplicação em `http://localhost:81`.

## Scripts úteis

```bash
bun run dev          # Next.js em desenvolvimento
bun run build        # build de produção
bun run start        # inicia build standalone
bun run lint         # ESLint
bun run db:push      # sincroniza schema Prisma
bun run db:generate  # gera Prisma Client
```

O diretório `.zscripts/` também contém scripts de automação usados no ambiente original do projeto.

## Persistência local

- Prisma usa `db/custom.db` para os modelos da aplicação.
- O game server cria `mini-services/game-server/src/save.json` em runtime para salvar progresso dos jogadores. Esse arquivo é ignorado pelo Git e não deve ser publicado com dados locais.

## Estado do projeto

O jogo já contém mapa, combate, skills elementais, monstros, missões, loja, poções, progressão, HUD, controles touch e servidor multiplayer em tempo real. Consulte `worklog.md` para o histórico técnico detalhado.
