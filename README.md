# StudyTrack

A clean, dark-mode assignment and study tracker built as an installable web app — works on your laptop and phone.

## What it does

- **Assignments**: title, course, due date, priority (high/med/low), progress %, deadline countdowns
- **Events**: date/time/location for lectures, exams, meetings
- **Study sessions**: schedule focused study blocks with start/end times
- **Courses**: color-coded so everything stays organized
- **Five views**: Today's dashboard, Calendar grid, Assignments list, Courses, Study Sessions
- **Notifications**: reminders 1 day before & morning-of for assignments; at start time for study blocks
- **Offline-capable**: your data lives on your device (IndexedDB), works without internet after first load

## How to run it

You need to serve the folder with a local web server (just opening `index.html` won't enable notifications or installation):

**Easiest way (if you have Python):**
```bash
cd studytrack
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Or with Node:**
```bash
npx serve studytrack
```

**To put it online for real (free):** Drag the `studytrack` folder onto [Netlify Drop](https://app.netlify.com/drop) or push to GitHub Pages. You'll get a URL you can install on your phone.

## Install on your phone

Once it's hosted (or running on `localhost`):

**iPhone/iPad (Safari):**
1. Open the URL in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Now it lives on your home screen like a real app

**Android (Chrome):**
1. Open the URL in Chrome
2. Tap the three-dot menu
3. Tap "Install app" or "Add to Home screen"

**Desktop (Chrome/Edge):**
1. Open the URL
2. Click the install icon in the address bar (looks like a monitor with a down arrow)

## Notifications

Click "Enable notifications" in the bottom-left to allow them. You'll get:
- A reminder the morning before each assignment is due
- A reminder the morning it's due
- A reminder at the start time of any study block

**Note**: notifications only fire while the app/tab has been opened recently. For true background notifications (even when the app is closed for days), you'd need a backend server with push services — that's a bigger project.

## Tips

- Add your courses first so you can tag everything
- Click any day on the Calendar to quickly add an assignment for that date
- The "Today" view is the best place to land each morning
- Use the priority filter on the Assignments page to surface what's urgent
