# prototype
## background
I would like to do some prototypes.  At this point make your best guess on how to proceed without asking a lot of questions. This work will likely be thrown away

First delete any existing application code - it was just the sample provided by vue and is not needed.

## app
A scoring game for the card game "up and down the river"
Three page app using the most popular frameworks built for vue 3.
### page one, landing page
Show history of games played in the past.  Button to start a new game.
Next to each game in the history there should be a trash, continue, or new game to start a configuration of a new game with the same rules as the selected game.  Continue is the default if the game has not completed.  New game is the default if the game has been completed.

Layout:
- Top bar (shared across all pages): app title "Up and Down the River" on the left; clicking the title always returns Home.
- Page header row: page title "Game history" on the left; on the far right a primary "+ New game" button that goes to the empty configure page.
- Body: a single vertical list of games, newest first. Empty state when there are no games is a tonal info alert reading "No games yet. Click 'New game' to start one."
- Each row in the list shows, from left to right:
  - Primary line: comma-separated player names (in seating order).
  - Secondary line: created-at date/time • status ("Complete" or "In progress") • current leader's name and total score.
  - Right-aligned action cluster (in this order): a small icon-only trash button, then a single text/tonal action button whose label and behavior depend on game status:
    - If the game is **in progress**, the default action button is **"Continue"** (resumes scoring) and there is also a secondary "New game" button that opens the configure page pre-filled with this game's scoring rules and players.
    - If the game is **complete**, the default action button is **"New game"** (opens configure pre-filled with this game's rules/players) and there is also a secondary "View" button to open the read-only final-scores view of the completed game.
  - The default button is visually emphasized (filled/primary); the non-default is de-emphasized (text/tonal). Clicking anywhere on the row outside the buttons triggers the default action. Trash prompts for confirmation before deleting.
### configure game
Configure game with scoring rules and users, Button to start (and later resume).  The default number of cards is 2.
It is possible to reorder the players.
At the top 

Layout:
- Top bar: shared app bar (title "Up and Down the River" returns Home).
- Page header row: page title "Configure game" on the left; on the far right an action button — labeled **"Start game"** when configuring a brand-new game, or **"Resume game"** when this page was reached by going back from an in-progress game. The button is disabled until configuration is valid (≥ 2 non-blank player names and max cards ≥ 1).
- The body is two stacked cards: "Players" then "Scoring rules".
- **Players card** — one row per player, each row containing (left → right):
  - A drag handle / grip icon on the far left for reordering rows by drag-and-drop. Up and Down arrow icon-buttons next to the handle provide a non-drag fallback (disabled at the ends of the list).
  - The player's seat number (1, 2, 3, …) shown as a small label or chip.
  - A text field for the player's name, taking the remaining horizontal space.
  - A small icon-only remove (×) button at the far right, disabled when only 2 players remain.
  - Reordering a row updates the seat numbers immediately. Seat order is the dealing/bidding order (player in seat N+1 sits to the left of seat N).
  - Below the rows, a tonal "+ Add player" button (disabled at 8 players). The card starts with 4 empty rows.
- **Scoring rules card** — a two-column responsive grid of inputs (stacks to one column on narrow screens):
  - Number input: "Max cards per hand (also starting/ending size)" — **default 2**, min 1, max 13.
  - Number input: "Points per trick taken" — default 1, min 0.
  - Number input: "Bonus for making your exact bid" — default 10, min 0.
  - Select: "Missed-bid penalty" — options "Tricks only (no bonus, no penalty)" (default) and "Flat −10 for missing bid".
  - Full-width switch: "Enforce dealer hook (sum of bids ≠ hand size)" — default ON.
- Footer row under the two cards: a text-style "Cancel" button on the left (returns Home, discarding edits if this is a new game; returning to scoring if editing in place); a spacer; the primary "Start game" / "Resume game" button on the right (mirrors the header-row button so it's always reachable).
- When editing an in-progress game (reached via "back to configure" from the score page), the page header subtitle reads "Editing in-progress game — changes will apply to the remaining hands"; previously played hands are not retroactively rescored.
### score game
Track dealer, and current bidder and enter the bid for that users via possible buttons.  A bidder can bid 0 - the number of cards in the hand.

It should be possible to go back and configure the game to correct any mistakes in player order or scoring rules.  After changing the configuration it should be possible to "resume" the game. After resuming the game recalculate the scores based on the new rules.

The dealer can not make a bid that would allow all the sum of the bids to equal the number of tricks.

The page header should have a bubble on the right that states: Hand: <hand>/<total> Cards: <cards>

The "Standings" table should include a column for "Rank" with the player with most points having the 1 rank.

When recording tricks taken the default for each player should be their bid.

The current hand card should have a header of the Player's name followed by a bubble that has the phase of the game (BID PLAY TRICKS). In the BID phase show the bidding player.  In the PLAY phase show the first player to play. In the TRICKS phase prompt for each players result similar to the bid phase.  Offer the buttons for "-" <taken> "+" and then a button <next>.  The buttons should be well spread out to avoid fat finger mistakes.

As the amounts BID are recorded update the Hands Played section with the bids.

The Tricks Taken number should be red if they miss their bid.

After bidding is complete the hand will be played outside of the app.  At the end of the hand the app will start recording the tricks that each player accumulated. A total score will be tracked.  The score will be based on the rules defined earlier.

Layout:
- Top bar: shared app bar (title returns Home).
- Page header row (left → right):
  - Page title — **"Score game"** while in progress, **"Final scores"** when complete.
  - A text "Edit configuration" button (pencil icon) that navigates to the configure page for this game, where players can be reordered and rules adjusted; returning from there resumes scoring with the updated settings.
  - A spacer.
  - A status chip on the right reading exactly: **`Hand: <hand>/<total>  Cards: <cards>`** (e.g. `Hand: 3/13  Cards: 5`). Hidden when the game is complete.
- **Standings card** (always visible, at the top of the body):
  - A two-column compact table: "Player" | "Total".
  - Rows are listed in seat order. The row for the current dealer shows a small primary chip labeled "Dealer" next to the player's name (only while the game is in progress).
  - The leader's row is visually emphasized (e.g. bold or a leading trophy icon).
- **Current hand card** (only while the game is in progress; hidden when complete):
  - **Card header**: the active **player's name** on the left, followed by a phase chip on the right whose label is exactly one of **BID**, **PLAY**, or **TRICKS**. The name shown depends on the phase (see each sub-phase below). When no player is "active" (only possible at the start of TRICKS, before the user touches any stepper) the name area is empty and only the phase chip is visible.
  - **BID sub-phase** (chip: **BID**; shown until every player has bid):
    - Card header name = the **current bidder's name**, advancing one bidder at a time around the table (starts with the player to the dealer's left, ends with the dealer).
    - When the current bidder is the dealer **and** the dealer-hook rule is enabled, an inline hint to the right of the header name reads "(dealer hook: can't bid K)" where K = handSize − sum(otherBids).
    - A horizontal row of large bid buttons labeled `0, 1, 2, … handSize`. The forbidden dealer-hook value is omitted from the row (not just disabled) so it cannot be tapped.
    - Beneath the buttons, an "Undo last bid" text button (with undo icon), hidden until at least one bid has been placed; it rewinds the bid pointer by one and clears that bid.
    - A small read-only summary line below shows the bids placed so far in bid order: "Alice 2 · Bob 1 · Carol —" (em-dash for not-yet-bid players).
    - When the last bid is placed the card transitions to PLAY (no separate user action required).
  - **PLAY sub-phase** (chip: **PLAY**; shown while the hand is being played at the table):
    - Card header name = the **first player to play**, i.e. the player to the dealer's left.
    - Body: a short instruction line such as "Hand is being played. Tap **Done playing** when the hand is over." plus a read-only recap of the bids ("Alice 2 · Bob 1 · Carol 0 · Dave 3").
    - A single primary **"Done playing"** button advances the card to TRICKS.
  - **TRICKS sub-phase** (chip: **TRICKS**; shown after "Done playing"):
    - Card header name = **empty** initially; every time the user presses a `+` or `−` stepper button on a player's row, the header name updates to that player's name (so it reflects the most-recently-adjusted player).
    - A compact table with columns: "Player" | "Bid" | "Tricks taken".
    - The "Tricks taken" cell for each player is a stepper: [−] [number] [+], **pre-populated to that player's bid** (the user only nudges off the default when reality differs). Stepper is clamped to 0..handSize.
    - The Tricks-taken number is rendered in **red** for any player whose current tricks ≠ their bid (i.e. they are currently missing their bid); it returns to the default color when tricks === bid.
    - Below the table, a tonal status alert: green/success when the recorded tricks sum equals N, amber/warning otherwise. Text: "Tricks recorded: S / N".
    - A primary **"Finalize hand"** button at the bottom, disabled until S === N. Clicking it writes the hand's scores, advances to the next hand (resetting the card to its BID sub-phase) or marks the game complete on the last hand.
- **Hands played card** (always visible, at the bottom of the body):
  - A compact table with columns: "#" | "Cards" | one column per player (in seat order).
  - One row per hand in the up-and-down sequence. Future (not-yet-played) hands are rendered with muted text and an em-dash in each player cell. The currently-active hand row is highlighted.
  - Each finalized player cell shows "bid / tricks **(hand score)**" — e.g. "2 / 3 **(3)**". The "tricks" number in a finalized cell is rendered in red whenever tricks ≠ bid for that hand, consistent with the live coloring during the TRICKS phase.
- When the game is complete the current-hand card disappears, the page title becomes "Final scores", the standings card highlights the winner (top of leaderboard with a trophy chip), and a single "New game with same rules" button is shown at the bottom (links to configure pre-filled with this game's players and rules).

## clarifying Q&A (round 1)

**Q:** The doc says "most popular frameworks built for vue 3" but doesn't pin specifics. Which UI library should we use (Vuetify 3, PrimeVue, Naive UI, none, or "you decide")?
**A:** "you decide — record the questions and your answers in the prototype.md file and implement this."

## clarifying Q&A (round 2)

**Q:** (Same question, re-asked after I had initially picked Vuetify 4 "latest stable".)
**A:** "Vuetify 3 (Material Design, most popular Vue 3 UI lib)" — so the prototype is pinned to Vuetify 3 (currently `3.12.8`, the latest v3-stable on npm), not Vuetify 4. The component APIs and `createVuetify` setup we use are the same across v3 and v4, so no source-code changes were needed — only the `vuetify` dependency version was downgraded.

## decisions made

Per the "best guess, don't ask a lot of questions" guidance plus the "you decide" answer above, the following decisions were made for the prototype:

- **State management:** Pinia (the official, most popular store for Vue 3).
- **Persistence:** `pinia-plugin-persistedstate` writing to `localStorage` — keeps the prototype self-contained (no Firebase wiring needed yet, even though `.firebaserc` exists).
- **UI library:** Vuetify 3 (Material Design, the most popular Vue 3 component library). Includes MDI icon font.
- **Routing:** existing `vue-router` (3 routes: `/`, `/configure`, `/score/:id`).
- **Hand progression:** classic "up and down" — deal N cards, decrement to 1, then back up to N. Configurable starting hand size (default 7).
- **Scoring rules (configurable):**
  - Points per trick taken: default 1.
  - Bonus for making your exact bid: default 10.
  - Penalty for missing bid: either `0` (just count tricks) or `-10` flat — default 0 (i.e. a missed bid scores only the tricks taken; classic "Oh Hell" / "up the river" variant).
  - "Dealer hook" rule (sum of bids cannot equal number of tricks) — toggle, default ON.
- **Players:** 2–8, names entered on the configure page. Dealer rotates each hand.
- **History:** every completed (or in-progress) game saved in the Pinia store; landing page lists them with date, players, final scores, and a resume/view link.

