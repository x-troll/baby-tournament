# Future todos

## General

- Why is admin email still used? I just want a username, daddy (set in env file, of course)

## URL's / slugs

- the slug numbers are too large, make them /1, /2, etc

- the links sent to users in telegram are too long. The token in the url, can it be shortened?

## Baby panel 

- Allow babies to set a picture of predefined animals as their profile pic, when setting their name. will be suppiied later in a folder. All folder files => a valid option to choose from. Show the picture on the baby profile page and inside the brackets, next to names. just have two sample placeholders for now. if you need a config file to map the pics to options, that can be the master list of pics, you decide. Should be allowed to change after setting up profile.

- During registering and afterwards, allow a dropdown menu of options for what they would prefer to call their organizer. Label "Organizer role". Options: Mommy, Daddy, Caretaker, Big bro, Big sis, Hunky nerd, Sissy. This option should be reflected in the solution when calling for help. Should also be marked in the telegram message to the organizer, what they are referring me as.

- During registering and afterwards, allow a dropdown menu of options for what the organizer and the UI should refer/call the baby. Label: "Your role". Options: Baby, Boy, Girl, Little bro, Little sister, Sissy, Mommy, Daddy. This should be reflected in the UI, e.g., Welcome X in both telegram and ui, and in telegram when requesting help from organizer

## Telegram

- Send a notification to babies when they're soon up (with estimate time, based on the configured time a round is supposed to take (depending on rule, e.g. if 3 maps, would be around 10-12 min i've setup)). Should include the link to the page where they can view their own dashboard. Could this be a button in telegram? not a link? Or not possible?

- Haven't tested this, but I'm assuming it's sending a message when it's actually their turn. So two messages per match. Should include a link to the same dashboard as above, but worded as "Update playtime status: xxx".

- Could there also be a button here to directly inside Telegram to say "Everyone's here, we're playing, {ORGANIZER NAME}". Reply "Good {BABY NAME}". So possible to do it both inside the web ui and inside telegram. And of, course shouldn't fail or crash if doing it both places.

- Should be possible for all players to say "we're playing", but not required. If two players click we're playing, it won't change anything accidentally. even if a second player clicks it looooong after finishing. Make sure statusen in playpens cannot go lower, only higher, if that makes sense. Failsafing for technology proficient users.

## Admin panel - General

- Add a profile picture for daddy too, shown when requesting help. Will add a real picture later, just have a basic placeholder as a file for now.

## Admin panel - Playtimes

- move the create new playtime to a button up top, right leaning,  called "Create Playtime" and show the view in a modal to create a new one. refreshes list of playtimes automatically, if not already done

- add a delete all torunaments button inside the admin view. add the button to the left of the create new. modal with confirmation.

- remove "Existing playtimes" subtitle, since the title up top with "Playtimes" is enough, now that creating is a separate button

- make the games names shown be names, not enums. Make them as pills, one color for smash and another for mario kart. add the pills directly after the name of playtime.

- make the enums for status be better nanes, not enum. make them into pills with suiting colors for the status type. add it last, after amount of babies.

#### Inside a playtime

- Move playpen component out of the tabbed view, up top, full width of screen. Below is tabbed view of "Score" (previously Star Charts) and "Matches"

- Use same badges and names, not enums, as the overview of all playtimes

- Remove the separator line between columns, instead, alternate between a slightly darker bakground color for the entire column. So column 1 is current color, 2 is slightly darker, 3 is current, 4 is slightly darker

### Spectator view (no login)

- Remove the title of playtime at the top

- Remove the score board at the bottom

- Show "Get ready to play. x vs y vs z. Remember to click "Start playing" inside Telegram". And change to "Currently playing. x vs y va z" (but two lines, as it currently is).

### Help requests

- change name to "Requests"

- Add a number badge to amount of non-solved requests

### My profile

- Change to settings

- Move to right side, and remove "Daddy" name. So just "Settings" and "Sign out"

- Is it possible to automate "Bot setup"? So whenever the application is starting, check if the webhook is working, otherwise, run it. 

- I will likely want different bots for different environments, is it supported?