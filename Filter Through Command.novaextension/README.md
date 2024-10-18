**Filter Through Command** runs a specified terminal command on the selected text.

The results can replace it, insert after it, or create a new document.

Commands can be user-specified and a small library of commented examples are included.


## Usage

To run Filter Through Command:

- Select the **Editor → Filter Through Command** menu item; or
- Open the command palette and type `Filter Through Command`

You might also choose to set a keyboard shortcut using **Nova → Settings... → Key Bindings**, such as:

- `Cmd`+`Control`+`|` to invoke `Filter Through Command...`
- `Cmd`+`|` to invoke `Filter Through Custom Command...`


### Configuration

To configure global preferences, open **Extensions → Extension Library...** then select Filter Through Command's **Settings** tab.

Shell:

- /bin/zsh
- /bin/bash
- /bin/sh

Output Mode:

- Replace
- Insert After
- New Document

Command List:

- add or remove new commands
- can be followed by a # comment

> Note: to reset the Command List to Defaults, delete the edited list from `~/Library/Application Support/Nova/UserConfiguration.json`


## Screenshots

![](https://raw.githubusercontent.com/gingerbeardman/Filter-Through-Command/refs/heads/main/nova-filter-through-custom-command.png)

![](https://raw.githubusercontent.com/gingerbeardman/Filter-Through-Command/refs/heads/main/nova-filter-through-command.png)
