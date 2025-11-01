# 🚀 Деплой Pirates 3D

Руководство по размещению игры на различных платформах для iOS установки.

## 📋 Подготовка

1. **Сгенерируйте иконки:**
   - Запустите `generate-icons.bat` (Windows)
   - Или откройте `generate-icons.html` в браузере
   - Скачайте все иконки и поместите в корневую папку

2. **Проверьте файлы:**
```
✅ index.html
✅ manifest.json
✅ sw.js
✅ icon-152.png
✅ icon-167.png
✅ icon-180.png
✅ icon-192.png
✅ icon-512.png
✅ Все .js файлы
✅ style.css
```

---

## 🌐 Вариант 1: GitHub Pages (Бесплатно, Рекомендуется)

### Шаг 1: Создайте репозиторий
```bash
# В папке игры
git init
git add .
git commit -m "Initial commit - Pirates 3D v1.01"
```

### Шаг 2: Загрузите на GitHub
1. Создайте новый репозиторий на https://github.com
2. Выполните команды:
```bash
git remote add origin https://github.com/USERNAME/pirates-3d.git
git branch -M main
git push -u origin main
```

### Шаг 3: Включите GitHub Pages
1. Откройте Settings → Pages
2. Source: `main` branch, `/ (root)` folder
3. Нажмите Save

### Шаг 4: Получите ссылку
```
https://USERNAME.github.io/pirates-3d/
```

✅ **Готово!** Игра доступна по HTTPS и готова к установке на iOS

---

## 🎯 Вариант 2: Netlify Drop (Самый простой)

### Способ А: Drag & Drop

1. Перейдите на https://app.netlify.com/drop
2. Перетащите папку с игрой в окно браузера
3. Дождитесь загрузки
4. Получите ссылку: `https://random-name.netlify.app`

### Способ B: Netlify CLI

```bash
# Установите Netlify CLI
npm install -g netlify-cli

# Деплой
cd path/to/game
netlify deploy --prod

# Следуйте инструкциям в терминале
```

✅ **Готово!** Автоматически получаете HTTPS

---

## ☁️ Вариант 3: Vercel (Бесплатно)

```bash
# Установите Vercel CLI
npm install -g vercel

# Деплой
cd path/to/game
vercel --prod

# Следуйте инструкциям
```

✅ **Готово!** Мгновенный деплой с HTTPS

---

## 🖥️ Вариант 4: Собственный сервер

### Nginx (Linux)

1. **Установите Nginx:**
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

2. **Настройте сайт:**
```nginx
# /etc/nginx/sites-available/pirates3d
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/pirates3d;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

3. **Активируйте:**
```bash
sudo ln -s /etc/nginx/sites-available/pirates3d /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Получите SSL сертификат:**
```bash
sudo certbot --nginx -d yourdomain.com
```

### Apache (Linux)

1. **Установите Apache:**
```bash
sudo apt update
sudo apt install apache2 certbot python3-certbot-apache
```

2. **Настройте сайт:**
```apache
# /etc/apache2/sites-available/pirates3d.conf
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/pirates3d
    
    <Directory /var/www/pirates3d>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

3. **Активируйте:**
```bash
sudo a2ensite pirates3d
sudo systemctl reload apache2
sudo certbot --apache -d yourdomain.com
```

---

## 🧪 Вариант 5: Локальный HTTPS (Тестирование)

### Node.js (http-server)

```bash
# Установите
npm install -g http-server

# Создайте SSL сертификаты (self-signed)
openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout key.pem -out cert.pem

# Запустите
http-server -S -C cert.pem -K key.pem -p 8443

# Откройте: https://localhost:8443
# (Примите предупреждение о сертификате)
```

### Python

```bash
# Создайте SSL сертификаты
openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout key.pem -out cert.pem

# Создайте server.py:
# (смотрите содержимое ниже)

# Запустите
python3 server.py
```

**server.py:**
```python
import http.server
import ssl

server_address = ('localhost', 8443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket,
                               server_side=True,
                               certfile='cert.pem',
                               keyfile='key.pem',
                               ssl_version=ssl.PROTOCOL_TLS)
print("Server running on https://localhost:8443")
httpd.serve_forever()
```

---

## 📱 Установка на iOS после деплоя

1. Откройте игру в **Safari** на iPhone/iPad
2. Нажмите кнопку "Поделиться" (⎋)
3. Выберите "На экран «Домой»"
4. Нажмите "Добавить"

✅ Игра установлена как приложение!

---

## ✅ Чек-лист перед деплоем

- [ ] Все иконки созданы и на месте
- [ ] `manifest.json` настроен
- [ ] `sw.js` (Service Worker) работает
- [ ] Игра протестирована локально
- [ ] HTTPS включен (обязательно для iOS!)
- [ ] Все файлы загружены на сервер
- [ ] Открывается в Safari на iOS
- [ ] Можно добавить на домашний экран

---

## 🐛 Решение проблем

### "Не могу добавить на домашний экран"
- ✅ Используйте Safari (не Chrome!)
- ✅ Проверьте, что сайт открыт по HTTPS
- ✅ manifest.json доступен

### "Service Worker не регистрируется"
- ✅ HTTPS обязателен (кроме localhost)
- ✅ Проверьте консоль браузера (F12)
- ✅ Очистите кэш и перезагрузите

### "Иконки не отображаются"
- ✅ Проверьте пути в index.html
- ✅ Убедитесь, что файлы загружены
- ✅ Откройте иконки напрямую в браузере

---

**Готово к запуску! 🚀🏴‍☠️**

