# todos

split into phases, commit after each (+ testing and everything), but please complete all phases in one go.

- add more space between the qr codes, so it's easier to scan correctly. increase the width of the page slightly

- move the "Recommended" banner thing to the top left side, make it slightly bigger.

- underline and bold the text "No notifications". Make the entire subtitle text here slightly bigger.

- Move the game logo to inside the header box, before "Getting ready" text, and don't write the game in text. Keep scan to join where it is.

- change /live and /admin to be /playtimes, and combine them

- have /playtimes be a list of all active (non-finished) games when viewing unauthenticated, and allow me to click into them. re-use same code as in /admin, but hide feature to create and delete toruneys. And hide finished when viewing unauthenticated. exactly as it is now when authed as an admin only

- add a link back to playtimes (/playtimes) when viewing a 

- combine the existing /live/{slug} and /admin/playtimes/{slug} pages. add in the status pills and remove game pill. keep station numbers. when non-authed, only view the header and bracket view. hide scores and matches, as it is now. use full width of page. hide navbar when non-authed.

- change the /  /playtimes/{slug} to be same auto-increment numbers as in /live/{slug}

- redirect always frontpage to /playtimes, so if not authenticated, goes straight to the list (totally fine for now, will consider simple pw protection later) 

- update the navbar to show which url you're on

- Add a text logo, "Troll Tournament"

- Refsctor the code that handle all user inputs. I want to be sure that everything the user does, e.g. "we're playing" from either telegram or the web ui calls the same method, so the behaviour is the same.

- Add in browser notifcations as fallback, if no telegram added for user. so just have a notification handler, which dynamically chooses telegram or browser. Actually, do both if possible, and always browser. this will help with testing without telegram connection ´s for each user.

- main idea behind some of these changes + previous ones, is to simplify the codebase, re-use, and ensure all the different paths to the same outcome behaves the same.

- remove "Delete all torunaments" from playtimes, instead move it to settings panel.

- add a button inside the settings panel to nuke the database back to basic, so no users, tourneys, results, nothing.

- add a "Notification Logs" tab in navbar, and log every notification sent. Show they in a nicew way to say verify everything works, when testing and actually playing.

# ignore everything below

- if a user deletes the chat with the bot, and scan again, tries to use /start command, what will happen? can they then re-sign up? New user? Will this cause any problems?