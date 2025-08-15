# Venditio PTA

A [Next.js](https://nextjs.org) project built with [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18.17 or later)
- **npm** (comes with Node.js)

To check your versions:

```bash
node --version
npm --version
```

### 1. Navigate to Project Directory

First, navigate to the project directory:

```bash
# Navigate to main project folder
cd "your-project-folder"

# Navigate to project subfolder
cd venditio-pta
```

**⚠️ Important:** Make sure you're in the `venditio-pta` folder where the `package.json` file is located.

### 2. Install Dependencies

Install project dependencies:

```bash
npm install
```

**Expected output:**

```
added XXX packages, and audited XXX packages in Xs
found 0 vulnerabilities
```

### 3. Start Development Server

Start the project in development mode:

```bash
npm run dev
```

**Expected output:**

```
> venditio-pta@0.1.0 dev
> next dev

   - Local:        http://localhost:3000
   - Network:      http://YOUR_IP:3000

 ✓ Starting...
 ✓ Ready in 5.2s
```

### 4. Open in Browser

Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

## 🔧 Troubleshooting Common Issues

### Error: "Could not read package.json"

**Symptoms:**

```
npm error code ENOENT
npm error syscall open
npm error path /path/to/your/project/package.json
npm error errno -4058
npm error enoent Could not read package.json
```

**Solutions:**

- You're in the wrong directory
- Use `cd venditio-pta` to navigate to the correct folder
- Use `dir` command to verify `package.json` exists

### Error: "Port 3000 is already in use"

**Solutions:**

```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (get PID from above command)
taskkill /PID <PID_NUMBER> /F
```

**Alternative solutions:**

- Use a different port: `npm run dev -- -p 3001`
- Restart your terminal/command prompt
- Restart your computer if necessary

### Error: "Module not found" or "Cannot resolve module"

**Solutions:**

```bash
# Remove node_modules directory
rmdir /s node_modules

# Remove package-lock.json
del package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install
```

### Error: "TypeScript compilation failed"

**Solutions:**

```bash
# Check TypeScript version compatibility
npm list typescript

# Reinstall TypeScript
npm install typescript@latest

# Clear TypeScript cache
npx tsc --build --clean
```

### Error: "ESLint configuration error"

**Solutions:**

```bash
# Reinstall ESLint
npm install eslint@latest

# Clear ESLint cache
npx eslint --cache-location .eslintcache --cache false .
```

## 📁 Project Structure

```
venditio-pta/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── api/       # API routes
│   │   │   ├── agent/ # Agent API endpoints
│   │   │   └── ...    # Other API routes
│   │   ├── layout.tsx # Main layout
│   │   └── page.tsx   # Main page
│   └── server/        # Server-side code
├── public/            # Static files
├── package.json       # Project dependencies
├── next.config.ts     # Next.js configuration
├── tsconfig.json      # TypeScript configuration
└── eslint.config.mjs  # ESLint configuration
```

## 🛠️ Available Scripts

```bash
# Start development server
npm run dev

# Create production build
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## 🌐 Access URLs

- **Local:** http://localhost:3000
- **Network:** http://YOUR_IP:3000 (local network)

## 📝 Development

Edit `src/app/page.tsx` to modify the page. Changes will be reflected automatically.

## 📚 Additional Resources

For more information about Next.js:

- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [Next.js Learn](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Next.js GitHub Repository](https://github.com/vercel/next.js)

## 🚀 Deployment

The easiest way to deploy your Next.js app is using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

For more details, check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

---

---

# Venditio PTA

Bu proje [Next.js](https://nextjs.org) ile oluşturulmuş bir [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) projesidir.

---

## 🚀 Projeyi Başlatma

### Ön Gereksinimler

Başlamadan önce aşağıdakilerin yüklü olduğundan emin olun:

- **Node.js** (18.17 veya daha yeni sürüm)
- **npm** (Node.js ile birlikte gelir)

Sürümlerinizi kontrol etmek için:

```bash
node --version
npm --version
```

### 1. Proje Dizinine Geçiş

Öncelikle proje dizinine geçmeniz gerekiyor:

```bash
# Ana proje klasörüne geçin
cd "your-project-folder"

# Proje alt klasörüne geçin
cd venditio-pta
```

**⚠️ Önemli:** `package.json` dosyasının bulunduğu `venditio-pta` klasöründe olduğunuzdan emin olun.

### 2. Bağımlılıkları Yükleme

Proje bağımlılıklarını yükleyin:

```bash
npm install
```

**Beklenen çıktı:**

```
added XXX packages, and audited XXX packages in Xs
found 0 vulnerabilities
```

### 3. Geliştirme Sunucusunu Başlatma

Projeyi geliştirme modunda başlatın:

```bash
npm run dev
```

**Beklenen çıktı:**

```
> venditio-pta@0.1.0 dev
> next dev

   - Local:        http://localhost:3000
   - Network:      http://YOUR_IP:3000

 ✓ Starting...
 ✓ Ready in 5.2s
```

### 4. Tarayıcıda Açma

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine gidin.

## 🔧 Olası Hata Durumları ve Çözümleri

### Hata: "Could not read package.json"

**Belirti:**

```
npm error code ENOENT
npm error syscall open
npm error path /path/to/your/project/package.json
npm error errno -4058
npm error enoent Could not read package.json
```

**Çözüm:**

- Yanlış dizindesiniz
- `cd venditio-pta` komutu ile doğru klasöre geçin
- `dir` komutu ile `package.json` dosyasının varlığını kontrol edin

### Hata: "Port 3000 is already in use"

**Çözüm:**

```bash
# Port 3000'i kullanan işlemi bulun
netstat -ano | findstr :3000

# İşlemi sonlandırın (PID'yi yukarıdaki komuttan alın)
taskkill /PID <PID_NUMARASI> /F
```

**Alternatif çözümler:**

- Farklı port kullanın: `npm run dev -- -p 3001`
- Terminal/komut istemini yeniden başlatın
- Gerekirse bilgisayarınızı yeniden başlatın

### Hata: "Module not found" veya "Cannot resolve module"

**Çözüm:**

```bash
# node_modules klasörünü silin
rmdir /s node_modules

# package-lock.json'ı silin
del package-lock.json

# npm önbelleğini temizleyin
npm cache clean --force

# Bağımlılıkları yeniden yükleyin
npm install
```

### Hata: "TypeScript compilation failed"

**Çözüm:**

```bash
# TypeScript sürüm uyumluluğunu kontrol edin
npm list typescript

# TypeScript'i yeniden yükleyin
npm install typescript@latest

# TypeScript önbelleğini temizleyin
npx tsc --build --clean
```

### Hata: "ESLint configuration error"

**Çözüm:**

```bash
# ESLint'i yeniden yükleyin
npm install eslint@latest

# ESLint önbelleğini temizleyin
npx eslint --cache-location .eslintcache --cache false .
```

## 📁 Proje Yapısı

```
venditio-pta/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── api/       # API rotaları
│   │   │   ├── agent/ # Agent API uç noktaları
│   │   │   └── ...    # Diğer API rotaları
│   │   ├── layout.tsx # Ana layout
│   │   └── page.tsx   # Ana sayfa
│   └── server/        # Sunucu tarafı kodlar
├── public/            # Statik dosyalar
├── package.json       # Proje bağımlılıkları
├── next.config.ts     # Next.js konfigürasyonu
├── tsconfig.json      # TypeScript konfigürasyonu
└── eslint.config.mjs  # ESLint konfigürasyonu
```

## 🛠️ Kullanışlı Komutlar

```bash
# Geliştirme sunucusunu başlat
npm run dev

# Production build oluştur
npm run build

# Production sunucusunu başlat
npm start

# Linting çalıştır
npm run lint
```

## 🌐 Erişim Adresleri

- **Local:** http://localhost:3000
- **Network:** http://YOUR_IP:3000 (yerel ağda)

## 📝 Geliştirme

Sayfa düzenlemeleri için `src/app/page.tsx` dosyasını düzenleyin. Değişiklikler otomatik olarak güncellenecektir.

## 📚 Daha Fazla Bilgi

Next.js hakkında daha fazla bilgi için:

- [Next.js Dokümantasyonu](https://nextjs.org/docs) - Next.js özellikleri ve API'si
- [Next.js Öğrenme](https://nextjs.org/learn) - İnteraktif Next.js eğitimi
- [Next.js GitHub Repository](https://github.com/vercel/next.js)

## 🚀 Deployment

Next.js uygulamanızı deploy etmenin en kolay yolu [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) kullanmaktır.

Daha fazla detay için [Next.js deployment dokümantasyonunu](https://nextjs.org/docs/app/building-your-application/deploying) inceleyin.

---

## 🎯 Proje Hakkında

**Venditio PTA** - Trading Agent projesi. Next.js ile geliştirilmiş modern web uygulaması.

**Global Competition Ready!** 🌍
