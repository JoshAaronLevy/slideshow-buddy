# Context

We now have the macOS version of the application working. But we need to make some UI adjustments to ensure it looks good on macOS.

The first area we need to address is the music page/tab. Currently, after synced with Spotify, it clearly is still very much designed for iOS. We need to make it more macOS-friendly. For instance, the `.music-container` has a fixed max-width of `600px`, which is too narrow for a desktop application. Also, the layout and elements within the music page (the profile card, search bar, my playlists, recently played, etc.) should be adjusted to take advantage of the larger screen real estate available on macOS. I know I am being kind of vague here, but please use your judgment to make the necessary adjustments to improve the UI for macOS users.

The second area to address is the photo library/photo picker component. On macOS, it opens up just fine and functionality is good. But it would be better if it took up the full width of the window. Please adjust the styles accordingly to make it more suitable for macOS. And please make any other UI tweaks you think are necessary to enhance the user experience on macOS.