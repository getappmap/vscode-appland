# Change Log

All notable changes to the "appmap" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.2]

- "View source" from the context menu should now work in all cases
- Routes in the dependency map will now favor the normalized path if available
- Components which have no associated runtime execution data will not be displayed
- HTTP events in the trace view will now be named correctly when viewing an appmap generated from Java
- Packages will continue to be highlighted after expand, collapse or switching views
- Packages are now represented by their leafs instead of their top level identifier
- Links from a class to a query now go to the expected destination
- Details for query events no longer use the raw SQL as the title

## [0.3.1]
- Upgrade `@appland/appmap` to `v0.2.2`
- Rename 'component diagram' to 'dependency map'
- Rename 'flow view' to 'trace'
- 'Reset view' can be selected from the context menu from anywhere in the
  viewport
- Packages are now visible when expanded
- Fix an issue where long vertical columns could cause the diagrams to center
  out of the visible space.
- HTTP server responses are now visible in the event details panel

## [0.2.1]
- Update documentation

## [0.2.0]
- Allow 'view source code' from events, functions and classes
- Improved compatability with VS Code theme
- Reduced file size of extension

## [0.1.0]
- Initial release
