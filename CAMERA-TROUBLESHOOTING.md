# Camera Access in Mobile Browsers

## Problem
Modern mobile browsers require HTTPS for accessing device features like the camera due to security reasons. If you're running the game locally or on a non-secure HTTP connection, you'll see the "Camera API not supported" error in Chrome on mobile devices.

## Solution

### Option 1: Use ngrok for HTTPS (Recommended)

We've included a script that automatically sets up a secure HTTPS tunnel to your local server using ngrok:

1. Make sure you have Node.js installed
2. Run the script:
   ```
   ./start-with-https.sh
   ```
3. This will start your server and create an HTTPS URL that you can use on your mobile device
4. The HTTPS URL will be shown in the terminal (looks like `https://abc123.ngrok.io`)
5. Use this URL on your mobile device to access the game with full camera functionality

### Option 2: Manual Setup with Chrome Flags (For Development Only)

For Chrome on Android:
1. Type `chrome://flags` in the address bar
2. Search for "Insecure origins treated as secure"
3. Enter the URL of your server (e.g., `http://192.168.1.100:3000`)
4. Restart Chrome

### Option 3: Deploy to a Hosting Service with HTTPS

For production use, deploy your game to a hosting service that provides HTTPS:
- GitHub Pages
- Netlify
- Vercel
- Heroku

## Additional Camera Troubleshooting

If you still have issues:
- Make sure camera permissions are granted in the browser
- Try using Safari on iOS devices
- Check that no other app is using the camera
- Try closing other tabs that might be using the camera
- Restart your browser
