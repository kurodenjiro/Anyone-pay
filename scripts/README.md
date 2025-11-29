# Cronjob Scripts

## Running the Cronjob

The cronjob checks deposit statuses and executes x402 payments every 5 seconds.

### Option 1: JavaScript (Recommended)

```bash
npm run cronjob
```

Or directly:
```bash
node scripts/run-cronjob.js
```

### Option 2: TypeScript

If you have `tsx` installed:
```bash
npx tsx scripts/run-cronjob.ts
```

Or install tsx globally:
```bash
npm install -g tsx
tsx scripts/run-cronjob.ts
```

### Environment Variables

Set `NEXT_PUBLIC_BASE_URL` to point to your API:
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000 npm run cronjob
```

### Production Deployment

For production, you can:
1. Use a process manager like PM2:
   ```bash
   pm2 start scripts/run-cronjob.js --name cronjob
   ```

2. Use systemd (Linux):
   Create a service file at `/etc/systemd/system/cronjob.service`

3. Use Vercel Cron Jobs or similar cloud cron services

4. Use a simple cron job:
   ```bash
   */5 * * * * cd /path/to/project && node scripts/run-cronjob.js
   ```

