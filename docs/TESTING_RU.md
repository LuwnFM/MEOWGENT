# Тестирование SecOps MEOWGENT

Установите Git, Node.js 20 и Docker Desktop.

В PowerShell:

```powershell
git clone https://github.com/LuwnFM/Mrrrmeow.git
cd Mrrrmeow
git fetch origin
git checkout feat/meowgent-production-foundation
Copy-Item .env.example .env.local
docker compose -f docker-compose.test.yml up -d
npm ci
```

В `.env.local` укажите:

```dotenv
APP_ACCESS_CODE=replace-with-a-strong-private-code
POSTGRES_URL=postgresql://meowgent:local-test-password@localhost:5432/meowgent
REDIS_URL=redis://localhost:6379/0
OPENROUTER_API_KEY=your-openrouter-key
```

Удалите или закомментируйте `DATABASE_URL`, чтобы локальный PostgreSQL использовался через существующий адаптер `@vercel/postgres`. Не публикуйте `.env.local`.

Запустите `npm run dev` и откройте http://localhost:3000. Для чата нужен действующий ключ OpenRouter. Для исполнения заданий требуется отдельно настроенный Python worker; этот тестовый Compose запускает только PostgreSQL и Redis.

Проверки:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
npm run build
python -m unittest discover -s tests
```

Убедитесь, что чат без кода доступа возвращает 401, а задача после перезапуска веб-приложения остаётся в PostgreSQL.

Остановка: `docker compose -f docker-compose.test.yml down`. Не добавляйте `-v`, если хотите сохранить данные.

Для тестирования Kali-инструментов используйте изолированную виртуальную машину и только разрешённые цели; не запускайте привилегированный воркер на основной системе.
