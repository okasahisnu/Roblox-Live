const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const port = process.env.PORT || 3000; // Use the PORT environment variable or fallback to 3000

app.use(cors());

const tiktokUsername = process.env.TIKTOK_USERNAME || 'enonoms';
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

// Store the events to send to Roblox
let events = [];

// Cache for profile pictures to avoid frequent requests
let profilePicCache = {};

// Function to fetch profile picture URL (web scraping example)
async function fetchProfilePictureUrl(username) {
    if (profilePicCache[username]) {
        return profilePicCache[username];
    }

    const profileUrl = `https://www.tiktok.com/@${username}`;
    
    try {
        const response = await axios.get(profileUrl);
        const html = response.data;
        
        // Load HTML into Cheerio
        const $ = cheerio.load(html);
        
        // Extract profile picture URL from meta tags or specific elements
        const profilePicUrl = $('meta[property="og:image"]').attr('content');
        
        profilePicCache[username] = profilePicUrl; // Cache the URL
        return profilePicUrl;
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        return null;
    }
}

// Add a route to get events
app.get('/events', (req, res) => {
    res.json(events);
    // Clear the events after sending
    events = [];
});

// Handle connection and reconnection
function connectToTikTokLive() {
    tiktokLiveConnection.connect().then(state => {
        console.log(`Connected to ${tiktokUsername}'s live stream`);
    }).catch(err => {
        console.error('Failed to connect', attempting to reconnect in 10 seconds...', err);
        setTimeout(connectToTikTokLive, 10000); // Reconnect after 10 seconds
    });
}

connectToTikTokLive();

tiktokLiveConnection.on('chat', async (data) => {
    console.log(`Comment from ${data.uniqueId}: ${data.comment}`);
    let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
    events.push({ type: 'comment', user: data.uniqueId, comment: data.comment, profilePicUrl });
});

tiktokLiveConnection.on('like', async (data) => {
    console.log(`${data.uniqueId} sent ${data.likeCount} likes`);
    let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
    events.push({ type: 'like', user: data.uniqueId, likes: data.likeCount, profilePicUrl });
});

tiktokLiveConnection.on('social', async (data) => {
    if (data.displayType === 'share') {
        console.log(`${data.uniqueId} shared the live stream`);
        let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
        events.push({ type: 'share', user: data.uniqueId, profilePicUrl });
    }
});

tiktokLiveConnection.on('gift', async (data) => {
    console.log(`${data.uniqueId} sent a gift: ${data.giftName}`);
    let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
    events.push({ type: 'gift', user: data.uniqueId, giftName: data.giftName, giftCount: data.repeatCount, profilePicUrl });
});

tiktokLiveConnection.on('disconnected', () => {
    console.log('Disconnected from the live stream, attempting to reconnect...');
    setTimeout(connectToTikTokLive, 10000); // Reconnect after 10 seconds
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
