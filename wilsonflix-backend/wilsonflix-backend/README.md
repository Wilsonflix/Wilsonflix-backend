# 🎌 Wilsonflix Backend API

Backend completo para plataforma de anime — Node.js + Express + SQLite

---

## 🚀 Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edita o .env com os teus dados

# 3. Iniciar em desenvolvimento
npm run dev

# 4. Iniciar em produção
npm start
```

---

## 📡 Endpoints da API

### 🔐 AUTH — `/api/auth`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/register` | Criar conta | ❌ |
| POST | `/login` | Login | ❌ |
| POST | `/refresh` | Renovar token | ❌ |
| POST | `/logout` | Terminar sessão | ✅ |
| GET  | `/me` | Dados do utilizador | ✅ |
| PUT  | `/change-password` | Alterar senha | ✅ |
| POST | `/forgot-password` | Recuperar senha | ❌ |
| POST | `/reset-password` | Redefinir senha | ❌ |

### 🎌 ANIME — `/api/anime`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/` | Listar animes (filtros) | ❌ |
| GET | `/search?q=naruto` | Pesquisar | ❌ |
| GET | `/trending` | Em alta | ❌ |
| GET | `/airing` | Em exibição | ❌ |
| GET | `/upcoming` | Em breve | ❌ |
| GET | `/top-rated` | Top avaliados | ❌ |
| GET | `/:slug` | Detalhes do anime | ❌ |
| GET | `/:id/episodes` | Episódios | ❌ |
| POST | `/:id/rate` | Avaliar (1-10) | ✅ |
| POST | `/` | Criar anime | 👑 Admin |
| PUT | `/:id` | Editar anime | 👑 Admin |
| POST | `/:id/episodes` | Adicionar episódio | 👑 Admin |

### 👤 USERS — `/api/users`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| PUT | `/profile` | Atualizar perfil | ✅ |
| PUT | `/preferences` | Preferências | ✅ |
| PUT | `/avatar` | Trocar avatar | ✅ |
| GET | `/:username` | Perfil público | ❌ |

### 📋 WATCHLIST — `/api/watchlist`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/` | Minha watchlist | ✅ |
| POST | `/` | Adicionar | ✅ |
| PUT | `/:anime_id` | Atualizar status | ✅ |
| DELETE | `/:anime_id` | Remover | ✅ |

**Status possíveis:** `watching` `completed` `dropped` `plan_to_watch` `on_hold`

### 📺 HISTÓRICO — `/api/history`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/` | Histórico completo | ✅ |
| GET | `/continue` | Continuar a assistir | ✅ |
| POST | `/progress` | Guardar progresso | ✅ |
| DELETE | `/` | Limpar histórico | ✅ |

### 💬 COMENTÁRIOS — `/api/comments`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/anime/:id` | Comentários do anime | ❌ |
| GET | `/episode/:id` | Comentários do ep. | ❌ |
| POST | `/` | Criar comentário | ✅ |
| POST | `/:id/like` | Like/unlike | ✅ |
| DELETE | `/:id` | Eliminar | ✅ |

### 🔔 NOTIFICAÇÕES — `/api/notifications`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/` | Minhas notificações | ✅ |
| PUT | `/read-all` | Marcar todas lidas | ✅ |
| PUT | `/:id/read` | Marcar lida | ✅ |
| DELETE | `/:id` | Eliminar | ✅ |

### 💳 SUBSCRIÇÕES — `/api/subscriptions`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/plans` | Planos disponíveis | ❌ |
| GET | `/my` | Minha subscrição | ✅ |
| POST | `/activate` | Ativar plano | ✅ |
| POST | `/cancel` | Cancelar | ✅ |

### 👑 ADMIN — `/api/admin`
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/stats` | Dashboard stats | 👑 |
| GET | `/users` | Listar utilizadores | 👑 |
| PUT | `/users/:id/ban` | Banir/desbanir | 👑 |
| PUT | `/users/:id/role` | Alterar role | 👑 |
| GET | `/reports` | Ver reports | 👑 |
| PUT | `/reports/:id` | Resolver report | 👑 |
| DELETE | `/animes/:id` | Eliminar anime | 👑 |
| POST | `/promote` | Tornar-se admin | ✅ |

---

## 🔑 Autenticação

Inclui o token no header de cada pedido:
```
Authorization: Bearer SEU_ACCESS_TOKEN
```

---

## 📦 Filtros de Anime

```
GET /api/anime?status=current&genre=Ação&type=TV&year=2024&sort=avg_rating&order=DESC&page=1&limit=20
```

---

## 💳 Planos

| Plano | Preço | Funcionalidades |
|-------|-------|-----------------|
| Free | Grátis | Anúncios, SD 480p, 1 dispositivo |
| Premium | R$19,90/mês | Sem anúncios, HD 1080p, 2 dispositivos |
| Ultra | R$34,90/mês | Sem anúncios, 4K, 4 dispositivos, downloads |

---

## 🗄️ Base de Dados

SQLite com tabelas:
- `users` — contas e preferências
- `animes` — catálogo completo
- `episodes` — episódios
- `watch_history` — histórico e progresso
- `watchlist` — lista pessoal
- `ratings` — avaliações
- `comments` — comentários e respostas
- `comment_likes` — likes
- `notifications` — notificações
- `subscriptions` — planos pagos
- `genres` — géneros
- `reports` — denúncias
- `sessions` — sessões ativas
