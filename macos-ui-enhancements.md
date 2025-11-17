# Context

We need to make some UI/UX enhancements to improve the music page on the macOS version of the application. I want you to please make the following changes:

1. The profile card takes up way too much space. Instead of having that card, I want to instead add another icon in the toolbar at the top of the app. Next to the settings icon, please add a user profile icon. When clicked, it should open a small popover that shows the user's profile information (profile picture, name, email) and a disconnect from Spotify button.

2. The cards/sections for "Your Playlists" and "Recently Played" don't need to be in the main music page/tab. It should only have the search bar and a list of the custom playlists created by the user. Please remove those two sections from the main music page/tab.

3. When a user clicks the button to create a new playlist, the modal that opens up should take up the full width of the window on macOS. Please adjust the styles accordingly.

4. When a user clicks the button to add tracks to a playlist, the photo picker component that opens up should also take up the full width of the window on macOS. Please adjust the styles accordingly.

5. When a user clicks the button to add tracks to a playlist, the "My Library" tab should have sections for "Recently Played", "Albums", "Artists", and "Songs". Please add those sections to the "My Library" tab in the photo picker component. Each section should display a list of items with their respective thumbnails and titles. If you can't add all those sections, please add whatever you can. But keep the "Playlists" in a separate tab (as it is now).

6. **Bug Fix**: In the "Add Tracks" component, in the "Search" tab, when a user searches for a song title or artist name, it just says "Search failed", and in the console, I see a console error saying "Error searching music: TypeError: Cannot read properties of null (reading 'id')". Please fix this bug so that the search functionality works properly.