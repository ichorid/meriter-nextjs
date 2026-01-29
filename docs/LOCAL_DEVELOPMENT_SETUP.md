\# Инструкция по локальному запуску проекта Meriter



\## Быстрый старт (для AI ассистента)



Эта инструкция содержит все необходимые шаги для запуска проекта с нуля, включая решение типичных проблем.



---



\## Шаг 1: Подготовка репозитория



\### 1.1. Отмена незакомиченных изменений

```powershell

git restore .

git clean -fd

```



\### 1.2. Синхронизация с origin/dev

```powershell

git fetch origin dev

git reset --hard origin/dev

```



\### 1.3. Очистка кэша Git

```powershell

git gc --prune=now

```



\*\*Проверка:\*\*

```powershell

git status

\# Должно показать: "Your branch is up to date with 'origin/dev'"

\# И не должно быть незакомиченных изменений

```



---



\## Шаг 2: Установка зависимостей



```powershell

pnpm install

```



\*\*Важно:\*\* Проект использует `pnpm`, не `npm` или `yarn`.



\*\*Проверка:\*\* Команда должна завершиться без критических ошибок (предупреждения о peer dependencies допустимы).



---



\## Шаг 3: Настройка переменных окружения



\### 3.1. Создание .env файлов из примеров



```powershell

\# API

Copy-Item api\\env.example api\\.env



\# Web

Copy-Item web\\env.example web\\.env

```



\### 3.2. Настройка API (.env в папке api)



\*\*Критически важные переменные:\*\*



```env

\# Обязательно для работы Next.js SSR

DOMAIN=localhost



\# Режим Test User Fake Data (для локальной разработки)

FAKE\_DATA\_MODE=true

TEST\_AUTH\_MODE=true



\# MongoDB (для локальной разработки без Docker)

MONGO\_URL=mongodb://127.0.0.1:27017/meriter



\# JWT Secret (можно оставить дефолтный для dev)

JWT\_SECRET=your-super-secret-jwt-key-change-this-in-production

```



\*\*Проверка:\*\*

```powershell

Get-Content api\\.env | Select-String -Pattern "^DOMAIN|^FAKE\_DATA\_MODE|^TEST\_AUTH\_MODE"

\# Должно показать:

\# DOMAIN=localhost

\# FAKE\_DATA\_MODE=true

\# TEST\_AUTH\_MODE=true

```



\### 3.3. Настройка Web (.env в папке web)



\*\*Критически важные переменные:\*\*



```env

\# Обязательно для работы Next.js SSR

DOMAIN=localhost



\# Режим Test User Fake Data

NEXT\_PUBLIC\_FAKE\_DATA\_MODE=true

NEXT\_PUBLIC\_TEST\_AUTH\_MODE=true



\# ВАЖНО: НЕ устанавливайте NEXT\_PUBLIC\_API\_URL!

\# Оставьте его закомментированным, чтобы использовалось проксирование через Next.js

\# NEXT\_PUBLIC\_API\_URL=http://localhost:8002

```



\*\*Почему не нужно NEXT\_PUBLIC\_API\_URL:\*\*

\- Если установлен `NEXT\_PUBLIC\_API\_URL`, tRPC клиент будет обращаться напрямую к API

\- Это вызывает проблемы с CORS и "Failed to fetch" ошибки

\- Без этой переменной Next.js автоматически проксирует `/trpc/\*` и `/api/\*` на `http://localhost:8002`



\*\*Проверка:\*\*

```powershell

Get-Content web\\.env | Select-String -Pattern "^DOMAIN|^NEXT\_PUBLIC\_FAKE\_DATA\_MODE|^NEXT\_PUBLIC\_TEST\_AUTH\_MODE|^NEXT\_PUBLIC\_API\_URL"

\# Должно показать:

\# DOMAIN=localhost

\# NEXT\_PUBLIC\_FAKE\_DATA\_MODE=true

\# NEXT\_PUBLIC\_TEST\_AUTH\_MODE=true

\# NEXT\_PUBLIC\_API\_URL должно быть закомментировано (# в начале строки)

```



---



\## Шаг 4: Запуск серверов



\### 4.1. Запуск API сервера (NestJS)



\*\*Терминал 1:\*\*

```powershell

cd api

$env:DOMAIN="localhost"

pnpm dev

```



\*\*Ожидаемый вывод:\*\*

```

Application is running on: http://localhost:8002

✅ tRPC middleware mounted at /trpc

CORS enabled for development

```



\*\*Проверка:\*\*

```powershell

\# В другом терминале

try { 

&nbsp;   $response = Invoke-WebRequest -Uri "http://localhost:8002/api/v1/config" -TimeoutSec 3 -UseBasicParsing

&nbsp;   Write-Host "API Status: $($response.StatusCode)" 

} catch { 

&nbsp;   Write-Host "API Error: $($\_.Exception.Message)" 

}

\# Должно показать: API Status: 200

```



\### 4.2. Запуск Web сервера (Next.js)



\*\*Терминал 2:\*\*

```powershell

cd web

$env:DOMAIN="localhost"

$env:NEXT\_PUBLIC\_FAKE\_DATA\_MODE="true"

$env:NEXT\_PUBLIC\_TEST\_AUTH\_MODE="true"

pnpm dev

```



\*\*Ожидаемый вывод:\*\*

```

▲ Next.js 16.1.1

\- Local:        http://localhost:8001

```



\*\*Проверка:\*\*

```powershell

\# В другом терминале

try { 

&nbsp;   $response = Invoke-WebRequest -Uri "http://localhost:8001" -TimeoutSec 3 -UseBasicParsing

&nbsp;   Write-Host "Web Status: $($response.StatusCode)" 

} catch { 

&nbsp;   Write-Host "Web Error: $($\_.Exception.Message)" 

}

\# Должно показать: Web Status: 200

```



\*\*Проверка проксирования tRPC:\*\*

```powershell

try { 

&nbsp;   $response = Invoke-WebRequest -Uri "http://localhost:8001/trpc/users.getMe" -TimeoutSec 3 -UseBasicParsing

&nbsp;   Write-Host "tRPC Status: $($response.StatusCode)" 

} catch { 

&nbsp;   if ($\_.Exception.Response.StatusCode -eq 401) {

&nbsp;       Write-Host "tRPC работает! (401 - нормально для неавторизованных запросов)"

&nbsp;   } else {

&nbsp;       Write-Host "tRPC Error: $($\_.Exception.Message)"

&nbsp;   }

}

\# Должно показать: tRPC работает! (401 - нормально для неавторизованных запросов)

```



---



\## Шаг 5: Открытие приложения



```powershell

Start-Process "http://localhost:8001"

```



---



\## Типичные проблемы и решения



\### Проблема: "Failed to fetch" при tRPC запросах



\*\*Причина:\*\* Установлен `NEXT\_PUBLIC\_API\_URL` в `web/.env`



\*\*Решение:\*\*

```powershell

\# Закомментировать NEXT\_PUBLIC\_API\_URL в web/.env

(Get-Content web\\.env) -replace '^NEXT\_PUBLIC\_API\_URL=', '# NEXT\_PUBLIC\_API\_URL=' | Set-Content web\\.env



\# Перезапустить web сервер

```



\### Проблема: Next.js не запускается, ошибка "DOMAIN environment variable is required"



\*\*Причина:\*\* Отсутствует `DOMAIN=localhost` в `.env` файлах



\*\*Решение:\*\*

```powershell

\# Добавить в api/.env

Add-Content api\\.env "`nDOMAIN=localhost"



\# Добавить в web/.env

Add-Content web\\.env "`nDOMAIN=localhost"



\# Перезапустить серверы

```



\### Проблема: Сервер не отвечает на запросы



\*\*Проверка портов:\*\*

```powershell

netstat -ano | findstr ":8001 :8002"

\# Должно показать LISTENING для обоих портов

```



\*\*Если порты заняты:\*\*

```powershell

\# Найти процесс на порту 8001

$port8001 = Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue

if ($port8001) { Stop-Process -Id $port8001.OwningProcess -Force }



\# Найти процесс на порту 8002

$port8002 = Get-NetTCPConnection -LocalPort 8002 -ErrorAction SilentlyContinue

if ($port8002) { Stop-Process -Id $port8002.OwningProcess -Force }

```



\### Проблема: MongoDB не подключен



\*\*Проверка:\*\*

```powershell

\# Проверить, запущен ли MongoDB

Get-Service -Name MongoDB -ErrorAction SilentlyContinue



\# Или проверить подключение

try {

&nbsp;   $mongo = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 27017)

&nbsp;   $mongo.Close()

&nbsp;   Write-Host "MongoDB доступен"

} catch {

&nbsp;   Write-Host "MongoDB недоступен. Запустите MongoDB или используйте Docker Compose"

}

```



---



\## Режим Test User Fake Data



При включенных `FAKE\_DATA\_MODE=true` и `TEST\_AUTH\_MODE=true`:



1\. \*\*Аутентификация:\*\* Используйте эндпоинт `/api/v1/auth/fake` для входа

2\. \*\*Данные:\*\* Генерируются автоматически, не требуют реального Telegram аккаунта

3\. \*\*Безопасность:\*\* Работает только в режиме разработки, никогда не использовать в production



\*\*Проверка работы fake auth:\*\*

```powershell

try {

&nbsp;   $response = Invoke-WebRequest -Uri "http://localhost:8002/api/v1/auth/fake" -Method POST -TimeoutSec 3 -UseBasicParsing

&nbsp;   Write-Host "Fake Auth Status: $($response.StatusCode)"

} catch {

&nbsp;   Write-Host "Fake Auth Error: $($\_.Exception.Message)"

}

\# Должно показать: Fake Auth Status: 201

```



---



\## Структура портов



\- \*\*8001\*\* - Next.js Web сервер (фронтенд)

\- \*\*8002\*\* - NestJS API сервер (бэкенд)

\- \*\*8080\*\* - Caddy reverse proxy (опционально, если установлен)



\*\*Без Caddy:\*\*

\- Фронтенд: `http://localhost:8001`

\- API: `http://localhost:8002`

\- Next.js проксирует `/trpc/\*` и `/api/\*` на API сервер



\*\*С Caddy:\*\*

\- Единая точка входа: `http://localhost:8080`

\- Caddy проксирует `/api/\*` и `/trpc/\*` на порт 8002

\- Всё остальное на порт 8001



---



\## Чеклист перед началом работы



\- \[ ] Репозиторий синхронизирован с `origin/dev`

\- \[ ] Нет незакомиченных изменений

\- \[ ] Зависимости установлены (`pnpm install`)

\- \[ ] `api/.env` создан и содержит `DOMAIN=localhost`, `FAKE\_DATA\_MODE=true`, `TEST\_AUTH\_MODE=true`

\- \[ ] `web/.env` создан и содержит `DOMAIN=localhost`, `NEXT\_PUBLIC\_FAKE\_DATA\_MODE=true`, `NEXT\_PUBLIC\_TEST\_AUTH\_MODE=true`

\- \[ ] `NEXT\_PUBLIC\_API\_URL` закомментирован в `web/.env`

\- \[ ] MongoDB запущен (или используется Docker Compose)

\- \[ ] API сервер запущен на порту 8002 и отвечает

\- \[ ] Web сервер запущен на порту 8001 и отвечает

\- \[ ] tRPC запросы проходят через прокси (проверка через `/trpc/users.getMe`)



---



\## Дополнительные команды



\### Остановка всех серверов

```powershell

Get-Process | Where-Object {$\_.ProcessName -eq "node" -and (Get-NetTCPConnection -OwningProcess $\_.Id -ErrorAction SilentlyContinue | Where-Object {$\_.LocalPort -in @(8001,8002)})} | Stop-Process -Force

```



\### Проверка статуса всех сервисов

```powershell

Write-Host "=== Статус серверов ===" -ForegroundColor Green



\# API

try { 

&nbsp;   $r = Invoke-WebRequest -Uri "http://localhost:8002/api/v1/config" -TimeoutSec 2 -UseBasicParsing

&nbsp;   Write-Host "API (8002): Работает ($($r.StatusCode))" -ForegroundColor Green

} catch { 

&nbsp;   Write-Host "API (8002): Не работает" -ForegroundColor Red

}



\# Web

try { 

&nbsp;   $r = Invoke-WebRequest -Uri "http://localhost:8001" -TimeoutSec 2 -UseBasicParsing

&nbsp;   Write-Host "Web (8001): Работает ($($r.StatusCode))" -ForegroundColor Green

} catch { 

&nbsp;   Write-Host "Web (8001): Не работает" -ForegroundColor Red

}



\# tRPC

try { 

&nbsp;   $r = Invoke-WebRequest -Uri "http://localhost:8001/trpc/users.getMe" -TimeoutSec 2 -UseBasicParsing

&nbsp;   Write-Host "tRPC: Работает ($($r.StatusCode))" -ForegroundColor Green

} catch { 

&nbsp;   if ($\_.Exception.Response.StatusCode -eq 401) {

&nbsp;       Write-Host "tRPC: Работает (401 - нормально)" -ForegroundColor Green

&nbsp;   } else {

&nbsp;       Write-Host "tRPC: Не работает" -ForegroundColor Red

&nbsp;   }

}

```



---



\## Примечания для Windows



\- Используйте PowerShell, а не CMD

\- Учитывайте кодировку при работе с .env файлами (используйте UTF-8)

\- Для переменных окружения в PowerShell используйте `$env:VARIABLE\_NAME="value"`

\- Команды `\&\&` не работают в PowerShell, используйте `;` или отдельные команды



---



\## Быстрая команда для полного перезапуска



```powershell

\# Остановка всех серверов

Get-Process | Where-Object {$\_.ProcessName -eq "node" -and (Get-NetTCPConnection -OwningProcess $\_.Id -ErrorAction SilentlyContinue | Where-Object {$\_.LocalPort -in @(8001,8002)})} | Stop-Process -Force



\# Синхронизация

git fetch origin dev

git reset --hard origin/dev



\# Очистка

git restore .

git clean -fd



\# Установка зависимостей

pnpm install



\# Запуск API (в отдельном терминале)

cd api; $env:DOMAIN="localhost"; pnpm dev



\# Запуск Web (в отдельном терминале)

cd web; $env:DOMAIN="localhost"; $env:NEXT\_PUBLIC\_FAKE\_DATA\_MODE="true"; $env:NEXT\_PUBLIC\_TEST\_AUTH\_MODE="true"; pnpm dev

```



---



\*\*Последнее обновление:\*\* 2024 (на основе опыта устранения проблем с запуском)





