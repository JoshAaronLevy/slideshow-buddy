### Context/Task

So we finally got it working so when a user clicks on "Settings", then clicks on the button to test photo permissions, we can now open the system photo permission prompt on macOS. Now, I'd like you to implement the following changes:

1. Carefully review the existing code that checks photo permissions, as well as the code that triggers the photo permission prompt when the user clicks the button in Settings and that whole process/flow.
  a. Clean up current console logs and comments that were used while we were trying to get this feature working. It should only log errors or important information (console warnings).
2. Update the code so the code/functions triggered when a user clicks that button are now invoked automatically when the app first launches, instead of waiting for user interaction.
  a. This includes checking to see if photo permissions have already been granted, and if not, triggering the system prompt to request access.
3. If there's a possibility after the user grants permission to the app to access photos that it'll take 2+ seconds for the app to process or detect (I'm not sure if additional things are happening under the hood after a user grants access, like indexing or caching. But that's what I mean by process or detect. Basically once the process has fully completed to the point where the photos can be displayed in the UI to the user) everything it needs from their library and update the app's state, please implement a loading spinner or some kind of visual feedback to indicate that the app is detecting photos.
4. Once the app can successfully access the user's photo library/detected photos, please implement a toast notification or some kind of visual confirmation that the app has successfully accessed their photos.
  a. This notification should only appear after the entire process regarding photo access is complete.
  b. The style or type of notification should be a "success" type notification, indicating to the user that everything went well, and noting they can see and select photos when they click the `+` button to create a new slideshow (but word it in a better way, if you can).
  c. The success notification should disappear automatically after a few seconds.
  d. If the user grants permission, but there's an error of any kind during the process of accessing their photos, please implement an error toast notification instead, with a relevant error message.
  e. The error notification should not automatically disappear, and should require the user to manually dismiss it.
5. If a user denies photo permissions when prompted at app launch, please implement a dialogue letting them know that they can still create slideshows, but will need to use the file importer to import photos manually. And let them know if they change their mind later, they can go to the Settings page to re-trigger the photo permission prompt.
  a. This dialogue should appear immediately after the user denies permission and the permission alert closes.
  b. The dialogue should have a button labeled "Got It!" to dismiss it.
6. In the Settings page, please update the button that tests photo permissions to reflect the new behavior:
  a. If the app already has photo permissions, the button should not be visible.
  b. If the app does not have photo permissions, the button should be visible.
  c. Change the button text to "Grant Photo Permissions".
  d. When clicked, it should re-trigger the photo permission prompt, following the same flow as at app launch (including loading spinner, success/error notifications, etc.). If this is something that needs to be done in the macOS Settings (i.e. if a user needs to go to System Preferences to manually enable photo permissions for the app), please implement a dialogue letting them know what to do. This dialogue should have a Cancel button that dismisses it, and an Update Settings button, which opens the macOS Settings app directly to the correct location.

## NOTES

For this task, do NOT make any changes regarding how the photos are displayed in the UI. The only changes should be regarding the permission prompt flow, loading indicators, and notifications/dialogues as described above. Once I have confirmed this is working as expected, I'll create a separate task to handle any UI changes regarding photo display.