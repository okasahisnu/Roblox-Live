const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const port = process.env.PORT || 3000; // Use the PORT environment variable or fallback to 3000

app.use(cors());

const tiktokUsername = 'noonaaigo1';
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

// Store the events to send to Roblox
let events = [];

// Function to fetch profile picture URL (web scraping example)
async function fetchProfilePictureUrl(username) {
    const profileUrl = `https://www.tiktok.com/@${username}`;
    
    try {
        const response = await axios.get(profileUrl);
        const html = response.data;
        
        // Load HTML into Cheerio
        const $ = cheerio.load(html);

        // Debugging: Print out the first 500 characters of the HTML
        console.log(html.substring(0, 500));
        
        // Extract profile picture URL from meta tags or specific elements
        const profilePicUrl = $('meta[property="og:image"]').attr('content');
        
        // Debugging: Print the meta tag content
        console.log($('meta[property="og:image"]').html());

        if (!profilePicUrl) {
            console.log('Profile picture URL not found in meta tags. Trying alternative method.');
            // Attempt an alternative method to find the profile picture URL
            const alternativeUrl = $('img.avatar').attr('src');
            console.log(`Alternative URL: ${alternativeUrl}`);
            return alternativeUrl;
        }
        
        console.log(`Profile picture URL for ${username}: ${profilePicUrl}`); // Log the profile picture URL
        
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

tiktokLiveConnection.connect().then(state => {
    console.log(`Connected to ${tiktokUsername}'s live stream`);
}).catch(err => {
    console.error('Failed to connect', err);
});

tiktokLiveConnection.on('chat', async (data) => {
    console.log(`Comment from ${data.uniqueId}: ${data.comment}`);
    try {
        let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
        events.push({ type: 'comment', user: data.uniqueId, comment: data.comment, profilePicUrl });
    } catch (error) {
        console.error('Error processing chat event:', error);
    }
});

tiktokLiveConnection.on('like', async (data) => {
    console.log(`${data.uniqueId} sent ${data.likeCount} likes`);
    try {
        let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
        events.push({ type: 'like', user: data.uniqueId, likes: data.likeCount, profilePicUrl });
    } catch (error) {
        console.error('Error processing like event:', error);
    }
});

tiktokLiveConnection.on('social', async (data) => {
    if (data.displayType === 'share') {
        console.log(`${data.uniqueId} shared the live stream`);
        try {
            let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
            events.push({ type: 'share', user: data.uniqueId, profilePicUrl });
        } catch (error) {
            console.error('Error processing share event:', error);
        }
    }
});

tiktokLiveConnection.on('gift', async (data) => {
    console.log(`${data.uniqueId} sent a gift: ${data.giftName}`);
    try {
        let profilePicUrl = await fetchProfilePictureUrl(data.uniqueId);
        events.push({ type: 'gift', user: data.uniqueId, giftName: data.giftName, giftCount: data.repeatCount, profilePicUrl });
    } catch (error) {
        console.error('Error processing gift event:', error);
    }
});

tiktokLiveConnection.on('disconnected', () => {
    console.log('Disconnected from the live stream');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
