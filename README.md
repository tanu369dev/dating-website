# Spark — Dating Website (static front-end)

Plain HTML/CSS/JS. No build step, no dependencies.

## Files
```
spark-dating/
├── index.html    # landing page + app UI + modals
├── styles.css    # all styling, animations, light/dark themes
├── data.js       # demo profiles, interests, icebreakers
├── app.js        # swipe cards, matching, chat, filters, storage
├── favicon.svg
├── vercel.json   # Vercel config (clean URLs, headers)
└── README.md
```

## Run locally
Just open `index.html`, or:
```
npx serve .
```

## Push to GitHub
```
cd spark-dating
git init
git add .
git commit -m "Spark dating website"
git branch -M main
git remote add origin https://github.com/<your-username>/spark-dating.git
git push -u origin main
```

## Deploy on Vercel
1. Go to vercel.com → **Add New… → Project**
2. Import the GitHub repo
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty
4. Click **Deploy**

## Features
- Animated landing page (floating hearts, blobs, floating cards, count-up stats, scroll reveals, marquee)
- Swipe cards: drag, buttons or keyboard (← → ↑, Z rewind, I info)
- Like / Nope / Super Like, Rewind, daily like limit
- Match celebration with confetti
- Compatibility score from shared interests
- Profile detail view with prompts and verified badges
- Chat with icebreakers, typing indicator and auto-replies
- Filters: gender, age, distance, interest, verified only
- "Who liked you" (Gold), Boost, Gold upgrade modal (demo)
- Editable profile, light/dark theme, progress saved in localStorage
- Responsive, reduced-motion friendly

## Notes
All profiles are fictional. Photos load from randomuser.me placeholders. Matches, chat and Gold are simulated in the browser; connecting real accounts or messaging would need a backend (e.g. Supabase or Firebase).
