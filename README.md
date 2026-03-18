# 💕 TwinFlame

> **Spațiul vostru secret, doar al vostru.**  
> O aplicație web pentru cupluri la distanță — conectați în timp real, oriunde v-ați afla.

---

## ✨ Features

| Feature | Descriere |
|---|---|
| 💓 **Pulse** | Trimite o vibrație partenerului tău cu un singur tap |
| 📍 **Locație live** | Vezi distanța față de partener în timp real |
| 💬 **Mesaje** | Trimite mesaje scurte care apar instant |
| 😊 **Mood** | Setează-ți starea de spirit (emoji) vizibilă partenerului |
| 📸 **Poze de profil** | Fiecare partener își poate seta propria poză |
| 🔋 **Baterie** | Vedeți nivelul de baterie al celuilalt |
| 🎵 **Muzică** | Împărtășiți ce ascultați în momentul de față |
| 📅 **Calendar comun** | Adăugați evenimente și date importante împreună |
| 📓 **Jurnal comun** | Scrieți gânduri pe care amândoi le pot citi |
| 🎯 **Provocări de cuplu** | Challenguri săptămânale cu scor și progres |
| ❤️ **Contor zile** | Numărul de zile de când sunteți împreună |

---

## 🚀 Demo rapid

1. Persoana A deschide aplicația → introduce numele → **"Creează codul vostru"**
2. Persoana A trimite codul generat (ex: `A3K9BZ`) partenerului
3. Persoana B deschide aplicația → introduce numele → lipește codul → **"Conectează-te"**
4. Gata — sunteți conectați în timp real 🎉

---

## 🛠️ Stack tehnic

- **Frontend:** HTML, CSS, JavaScript vanilla — un singur fișier `index.html`
- **Backend / Realtime DB:** [Firebase Firestore](https://firebase.google.com/docs/firestore)
- **Auth:** fără cont — autentificare prin cod de pereche unic
- **PWA ready:** se poate instala pe telefon ca aplicație nativă

---

## 📦 Instalare și rulare locală

```bash
git clone https://github.com/username/twinflame.git
cd twinflame
```

Nu există dependențe sau build step. Deschide direct `index.html` într-un browser sau servește-l cu orice server static:

```bash
# Cu Python
python -m http.server 8080

# Cu Node.js (npx)
npx serve .
```

---

## 🔥 Configurare Firebase

Aplicația folosește propriul proiect Firebase. Dacă vrei să o faci fork și să o găzduiești separat:

1. Creează un proiect nou pe [console.firebase.google.com](https://console.firebase.google.com)
2. Activează **Firestore Database** (mod test pentru început)
3. Copiază configurația din **Project Settings → Your apps → Web**
4. Înlocuiește obiectul `firebaseConfig` din `index.html`:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### Reguli Firestore recomandate

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /perechi/{pairCode} {
      allow read, write: if true; // schimbă cu auth în producție
    }
  }
}
```

---

## 📱 Instalare ca PWA (pe telefon)

**Android (Chrome):**
1. Deschide linkul aplicației în Chrome
2. Meniu (⋮) → *Adaugă pe ecranul principal*
3. Confirmă → aplicația apare pe home screen

**iPhone (Safari):**
1. Deschide linkul aplicației în Safari
2. Buton share (□↑) → *Adaugă pe ecran principal*
3. Confirmă → aplicația apare pe home screen

> ⚠️ Pentru ca butonul de instalare să funcționeze complet, adaugă un `manifest.json` și un `service-worker.js` în rădăcina proiectului.

---

## 🗂️ Structura proiectului

```
twinflame/
├── index.html        # Întreaga aplicație (HTML + CSS + JS)
├── manifest.json     # (opțional) PWA manifest
├── service-worker.js # (opțional) PWA offline support
├── icon-192.png      # (opțional) Iconiță PWA
└── README.md
```

---

## 🔒 Confidențialitate

- Nu se colectează date personale
- Perechile sunt identificate doar prin codul aleatoriu generat
- Pozele de profil sunt stocate ca base64 direct în Firestore (nu în Storage)
- Locația este trimisă doar când utilizatorul acordă permisiunea din browser

---

## 🤝 Contributing

Pull requests sunt binevenite! Pentru schimbări majore, deschide mai întâi un issue.

---

## 📄 Licență

[MIT](LICENSE)

---

<p align="center">Făcut cu 💕 pentru cuplurile la distanță</p>
