# Sanpress — Sistema de Atendimento e Fila de Produção

> **"Sua criatividade começa aqui"**
> Sistema interno de gestão de pedidos, fila de impressão e atendimento via WhatsApp para a **Sanpress**, copiadora e gráfica expressa universitária.

---

## 📋 Visão Geral

O **Sanpress System** é um painel web full-stack de uso interno, desenvolvido para otimizar o fluxo de trabalho da copiadora. Ele centraliza:

- Abertura de pedidos no balcão e via WhatsApp
- Gerenciamento da fila de produção em tempo real
- Histórico completo de pedidos
- Banco de clientes cadastrados (alunos, professores, empresas)
- Integração nativa com WhatsApp via Baileys (sem API paga)
- Dashboard com métricas de atendimento

---

## 🗂️ Estrutura do Projeto

```
atendimento-fila/
├── client/                  # Frontend React + Vite + Tailwind
│   └── src/
│       ├── pages/           # Telas principais do sistema
│       │   ├── Atendimento.jsx      # Balcão: abertura de pedidos
│       │   ├── FilaProducao.jsx     # Fila de impressão em tempo real
│       │   ├── Pedidos.jsx          # Histórico completo de pedidos
│       │   ├── Clientes.jsx         # Banco de clientes
│       │   ├── Whatsapp.jsx         # Painel de atendimento WhatsApp
│       │   └── Dashboard.jsx        # Métricas e relatórios
│       └── components/      # Componentes reutilizáveis
│           ├── ModalPedido.jsx           # Modal unificado de pedido
│           ├── ModalCadastroCliente.jsx  # Modal de cadastro/edição de cliente
│           ├── StatusBadge.jsx           # Badge de status de pedido
│           └── GlobalChatWidget.jsx      # Widget de chat global
│
└── server/                  # Backend Node.js + Express + SQLite
    └── src/
        ├── controllers/     # Lógica de negócio
        │   ├── orderController.js       # Pedidos (CRUD + status + itens)
        │   ├── clientController.js      # Clientes (CRUD + histórico)
        │   ├── whatsappController.js    # Integração WhatsApp
        │   └── dashboardController.js   # Métricas agregadas
        ├── services/
        │   ├── whatsappService.js       # Sessão Baileys e envio de mensagens
        │   └── fileService.js           # Abertura local de arquivos de impressão
        ├── db/knex.js       # Instância do banco SQLite via Knex
        ├── routes.js        # Rotas da API REST
        └── index.js         # Entry point (Express + Socket.IO)
```

---

## 🚀 Tecnologias

### Frontend
| Tech | Uso |
|---|---|
| **React 18** | Framework UI |
| **Vite** | Build tool + dev server |
| **Tailwind CSS** | Estilização utilitária com design system Sanpress |
| **Socket.IO Client** | Sincronização em tempo real entre estações |
| **Lucide React** | Ícones |

### Backend
| Tech | Uso |
|---|---|
| **Node.js + Express** | Servidor HTTP e API REST |
| **SQLite + Knex.js** | Banco de dados local relacional |
| **Socket.IO** | WebSockets para atualização em tempo real |
| **@whiskeysockets/Baileys** | Integração WhatsApp sem API paga |
| **Pino** | Logger de performance |

---

## ⚙️ Como Rodar

### Pré-requisitos
- Node.js 18+
- npm 9+

### 1. Backend

```bash
cd server
npm install

# Criar banco e rodar migrações
npm run migrate

# Iniciar servidor de desenvolvimento
npm run dev
```

O servidor sobe em **`http://localhost:3001`**

### 2. Frontend

```bash
cd client
npm install

# Iniciar dev server
npm run dev
```

O painel abre em **`http://localhost:5173`**

---

## 📱 Telas do Sistema

### 🛒 Atendimento (Balcão)
Abertura de pedidos para clientes que chegam presencialmente. Preenchimento de dados do cliente, seleção de serviços gráficos (impressão, pôster, encadernação, etc.), forma de pagamento e vinculação de arquivo.

### ⚙️ Fila de Produção
Painel em tempo real com todos os pedidos ativos. Mostra barra de progresso por status, permite avançar o pedido pelo fluxo (Pago → Na Fila → Em Impressão → Pronto → Entregue) com um clique. Atualização automática via WebSocket.

### 📋 Histórico de Pedidos
Tabela completa com todos os pedidos (incluindo cancelados e entregues). Filtros por status, origem (balcão/WhatsApp) e busca por cliente. Modal de detalhes com edição de itens em tempo real.

### 👥 Banco de Clientes
Cadastro e consulta de clientes (Aluno, Professor, Externo/B2B). Painel lateral com histórico de pedidos e arquivos enviados por cada cliente.

### 💬 WhatsApp
Painel integrado de atendimento via WhatsApp. Lista de conversas, visualização de mensagens, abertura de pedidos a partir de arquivos recebidos, cadastro rápido de novos clientes.

### 📊 Dashboard
Métricas de atendimento: pedidos por período, faturamento, origem dos pedidos, status da operação.

---

## 🔄 Fluxo de um Pedido

```
Atendimento (Balcão) ──┐
                       ├──► Aguardando Pagamento
WhatsApp ──────────────┘         │
                             Pedido Pago
                                 │
                            Na Fila / A Imprimir
                                 │
                            Em Impressão
                                 │
                            Pronto para Retirada
                                 │
                         Concluído / Entregue ── ou ── Cancelado
```

Cada transição de status **notifica automaticamente o cliente via WhatsApp** e atualiza todos os painéis abertos em tempo real via WebSocket.

---

## 🎨 Design System

Cores e tipografia seguem o **Manual de Marca Sanpress**:

| Token | Cor | Uso |
|---|---|---|
| `sp-blue` | `#2158a5` | Cor institucional principal |
| `sp-magenta` | `#e6007e` | Destaques criativos |
| `sp-yellow` | `#ffc400` | Alertas e destaques |
| `sp-cyan` | `#00b8e6` | Digital / Tech |
| Grafite | `#222222` | Texto principal |

Fontes: **Qurova** (títulos) e **Nexa** (corpo/UI)

---

## 🧩 Componentes Compartilhados

| Componente | Descrição |
|---|---|
| `ModalPedido` | Modal unificado de detalhes/edição de pedido. Suporta `mode="production"` (fila) e `mode="history"` (histórico) |
| `ModalCadastroCliente` | Formulário de cadastro e edição de clientes. Usado no balcão e no WhatsApp |
| `StatusBadge` | Badge de status com cores canônicas. Variants: `pill` (tabelas) e `inline` (cards) |

---

## 📝 Licença

Uso interno Sanpress. Todos os direitos reservados.
