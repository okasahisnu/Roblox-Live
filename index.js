const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const port = process.env.PORT || 3000; // Use the PORT environment variable or fallback to 3000

app.use(cors());

const tiktokUsername = process.env.TIKTOK_USERNAME || 'fahrezaos';
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

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

// Store events in different arrays based on type
let comments = [];
let likes = {};
let gifts = [];

// Add routes to get each type of event
app.get('/comment', (req, res) => {
    res.json(comments);
    // Clear the comments after sending
    comments = [];
});

app.get('/like', (req, res) => {
    res.json(Object.values(likes));
    // Clear the likes after sending
    likes = {};
});

app.get('/gift', (req, res) => {
    res.json(gifts);
    // Clear the gifts after sending
    gifts = [];
});

// Handle connection and reconnection
function connectToTikTokLive() {
    tiktokLiveConnection.connect().then(state => {
        console.log(`Connected to ${tiktokUsername}'s live stream`);
    }).catch(err => {
        console.error('Failed to connect', 'attempting to reconnect in 10 seconds...', err);
        setTimeout(connectToTikTokLive, 10000); // Reconnect after 10 seconds
    });
}

connectToTikTokLive();

tiktokLiveConnection.on('chat', async (data) => {
    console.log(`Comment from ${data.uniqueId}: ${data.comment}`);
    let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
    comments.push({ type: 'comment', user: data.uniqueId, comment: data.comment, profilePicUrl });
});

tiktokLiveConnection.on('like', async (data) => {
    console.log(`${data.uniqueId} sent ${data.likeCount} likes`);
    let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
    if (!likes[data.uniqueId]) {
        likes[data.uniqueId] = { type: 'like', user: data.uniqueId, likes: 0, profilePicUrl };
    }
    likes[data.uniqueId].likes += data.likeCount;

    // Log the current state of likes
    console.log('Current likes:', likes);
});

tiktokLiveConnection.on('social', async (data) => {
    if (data.displayType === 'share') {
        console.log(`${data.uniqueId} shared the live stream`);
        let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
        // You can handle shares similarly if needed
    }
});

tiktokLiveConnection.on('gift', async (data) => {
    console.log(`${data.uniqueId} sent a gift: ${data.giftName}`);
    let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
    gifts.push({ type: 'gift', user: data.uniqueId, giftName: data.giftName, giftCount: data.repeatCount, profilePicUrl });
});

tiktokLiveConnection.on('disconnected', () => {
    console.log('Disconnected from the live stream, attempting to reconnect...');
    setTimeout(connectToTikTokLive, 10000); // Reconnect after 10 seconds
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
