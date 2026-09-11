/** Tested Feishu guidance only; production may opt into bounded field recipes.
 * Never put snapshot tokens, window IDs, absolute coordinates or task data here.
 */
export function calendarRunbook({ draftOnly = false, enhanced = false } = {}) {
  return `
FEISHU CALENDAR RUNBOOK — follow this order, using the current tool results.

Execution discipline:
- Every computer_step already returns a new AX state. Use that state for the next action; do not add computer_observe just to read the same state again.
${enhanced ? '- computer_step accepts screenshot:true to return a fresh image WITH its post-action AX state. Use it when the NEXT action needs screenshot geometry (for example setting the title before editing the date). Do not call computer_observe again if that returned state already has the image you need. Field recipes handle their own observations; they do not require a preceding screenshot call.' : ''}
- Request screenshot:true when a pixel action needs current screenshot geometry, a control is missing from AX, or a returned state is ambiguous. After setValue, request a fresh screenshot before a pixel action. Never reuse a snapshotId or elementToken from an earlier state.
- Use an exact AX token for a uniquely identified button or editable field. Do not AX-click static time text to start editing: use the time recipe below directly.
- For a pixel action, locate the control in the current screenshot/AX frame and calculate its screenshot-relative center. Double-click means x/y/count:2 with NO elementToken. Scroll also uses current screenshot-relative x/y, not an elementToken.
- Check the returned state after each action. If the requested value is already correct and committed, skip editing it. When an action is refused, use the fresh state supplied with the error, correct the cause, and continue; do not repeat the same unsupported action or invent coordinates.

1. OPEN ONE OWNED EDITOR
If the main window already shows Calendar, use its Create Event button directly. Otherwise open Calendar once, then Create Event. ${enhanced ? 'On the Create Event click set waitForEditor:true. The tool waits for and selects the unique empty 创建日程 window, returning its state. No separate window-selection observation is needed. On timeout inspect the fresh state; never click Create again.' : 'Select the exact newly returned window titled 创建日程.'} An empty title can appear as 添加主题. Do not touch an existing user draft or create a second editor.

2. CHECK THE DESTINATION ONCE
FIRST inspect the returned AX state for the selected calendar-name text immediately followed by its combo box, before Save. The personal calendar owner's name also appears in the RIGHT scheduling panel; that duplicate is not another selected calendar. If the selected field already matches the requested name, this step is DONE: do not open the picker, scroll down or click its arrow. AX may expose this field even while it is below the viewport.
Only if that selected name differs, scroll the LEFT form down to its calendar selector. Inspect options once. If the picker does not open, allow at most one screenshot-grounded correction after an AX refusal; do not cycle through name, arrow, double-click and repeated coordinate guesses.
${draftOnly
    ? 'This is UNSAVED draft acceptance only: the selected calendar must exactly match the requested calendar. If unavailable, call computer_finish with completed:false. Never substitute another calendar, save or search settings for permission.'
    : 'Select the exact requested calendar and close the picker. If unavailable, call computer_blocked immediately. Do not fill another calendar, inspect settings for a workaround or try to change permissions.'}
If you scrolled down, return to the top of the left form to edit the fields. Do not reopen this selector unless the selected calendar has actually changed.

3. TITLE AND DATES
Use setValue on the title field with the full requested title. Inspect the two date values: if both already equal the requested date, leave them alone. Otherwise request a screenshot, click the START date control center, check the displayed month/year, then click the requested day in that month using its current screenshot center. Inspect BOTH resulting dates before deciding whether the end date also needs editing. Navigate months only using controls visible in the current state.

4. COMMITTED START AND END TIMES
${enhanced ? `Use computer_edit_field for startTime and endTime instead of the individual click/setValue/blur recipe. Example: {"field":"startTime","value":"14:00"}. Values must match the requested meeting. The result confirms committed values and returns BOTH times; if start-time linkage already produced the requested committed end time, skip the endTime call. Already-correct committed times need no call. On needs_attention, inspect stage/completed and the returned current state, then fix only that issue with the basic tools. Do not blindly repeat the whole recipe.

5. DESCRIPTION IN THE LEFT FORM
Call computer_edit_field with field:"description" and the COMPLETE requested text, including all lines. It handles bounded scrolling, expanding the editor, filling, blurring and checking rendered text. Do not pre-scroll, pre-expand or issue a separate screenshot call for this recipe. If it returns needs_attention, use the current state to correct the specific blocker; never claim that an unverified field is finished.` : `Identify the two time controls in the form's date row, ordered by horizontal position between the two date controls. Ignore the hourly labels in the right scheduling panel.
For each time that is not already the requested AXStaticText value:
  a. Obtain a current screenshot and pixel double-click that time's center.
  b. From the returned AX state, setValue on the resulting exact AXTextField token.
  c. Obtain a fresh screenshot, then pixel double-click the visible TITLE field center to commit/blur.
  d. In the returned state, require the edited time to be AXStaticText with the requested value.
Changing the start time may automatically shift the end time. Re-read the pair and skip the end-time recipe if it is already correct. An AXTextField value alone is not success. Do not use keyboard shortcuts or repeated single-click AXPress attempts.

5. DESCRIPTION IN THE LEFT FORM
Scroll down INSIDE the left form, away from the right time grid. Use a visible control within that panel (for example 添加会议室) to ground the scroll location. If 添加描述 is shown, activate it. Locate the visible description AXTextArea with a meaningful frame; a tiny hidden AXTextArea is not the editor.
Set the entire description once. Leave the description using a visible neutral area of the left form identified from a fresh screenshot (not a button that changes a meeting setting). If needed scroll the left form to show the description text. Require the requested text as rendered AXStaticText with a meaningful height, not only the editor value. Do not edit the description again just because it is outside the viewport; scroll to inspect it.
`}

6. FINAL CHECK WITHOUT EXPLORING UNRELATED CONTROLS
Verify title, BOTH dates, BOTH committed times, rendered description and the destination required by this task. Do not add attendees, meeting rooms, groups, reminders or change privacy. Preserve the actual attendee area. Keep the description visible for the independent checker; off-screen title/date values can still be inspected in AX.
${draftOnly
    ? 'Call computer_finish with completed:true only when the requested draft fields pass these checks. Do not Save. If the independent checker returns an issue, fix only that issue and check again; if blocked, report completed:false.'
    : 'Call computer_submit only after the checks pass. It independently verifies the form and performs the single permitted Save; API verification belongs to its caller. Never click Save through computer_step, never repeat submission after an uncertain result. If the checker returns an issue, fix only that issue; if blocked, call computer_blocked.'}
`;
}
