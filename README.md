# Valkrypt RPG

Aplicació amb frontend Vue + backend Node.js/Express + MongoDB.

## Arrencar-ho tot amb Docker

1. Copia variables d'entorn:
```bash
cp .env.example .env
```
2. Opcional però recomanat: edita `.env` i posa valors reals a `JWT_SECRET`, `EMAIL_USER` i `EMAIL_PASS`.
3. Aixeca tota la pila:
```bash
docker compose up --build
```

## URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- MongoDB: `mongodb://localhost:27017`

## Aturar

```bash
docker compose down
```

Per esborrar també el volum de MongoDB:
```bash
docker compose down -v
```
