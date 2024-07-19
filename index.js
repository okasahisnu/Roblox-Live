const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const port = process.env.PORT || 3000;
const tiktokUsername = 'fahrezaos';

app.use(cors());

let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);
let isLive = false;
let events = [];

// Function to fetch profile picture URL (web scraping example)
async function fetchProfilePictureUrl(username) {
    const profileUrl = `https://www.tiktok.com/@${username}`;
    try {
        const response = await axios.get(profileUrl);
        const html = response.data;
        const $ = cheerio.load(html);
        const profilePicUrl = $('meta[property="og:image"]').attr('content');
        return profilePicUrl;
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        return null;
    }
}

// Function to check if the stream is live
async function isStreamLive(username) {
    const url = `https://www.tiktok.com/@${username}/live`;
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        const liveIndicator = $('[data-e2e="live-indicator"]').length > 0;
        return liveIndicator;
    } catch (error) {
        console.error('Error checking live status:', error);
        return false;
    }
}

// Add a route to get events
app.get('/events', (req, res) => {
    res.json(events);
    events = [];
});

// Add a route to get stream status
app.get('/status', async (req, res) => {
    isLive = await isStreamLive(tiktokUsername);
    if (isLive) {
        res.send('Streaming live');
    } else {
        res.send('Streaming offline');
    }
});

// Connect to TikTok stream if live
async function connectToStream() {
    isLive = await isStreamLive(tiktokUsername);
    if (isLive) {
        tiktokLiveConnection.connect().then(state => {
            console.log(`Connected to ${tiktokUsername}'s live stream`);
        }).catch(err => {
            console.error('Failed to connect', err);
        });
    } else {
        console.log('Streaming offline');
    }
}

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
    console.log('Disconnected from the live stream');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    connectToStream();
});
