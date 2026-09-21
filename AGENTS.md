# Portfolio deployment authorization rule

This rule applies to every task in this repository.

## Allowed deployment material

- Only deploy an image, video, file, or link that the user explicitly provides or identifies in the current request.
- Treat an exact attachment path, exact file path, or exact URL supplied by the user as authorization for that item only.
- Read repository source, configuration, and tests only as needed to integrate and verify the authorized item.

## Forbidden discovery and upload

- Do not enumerate, search, or scan other local folders for candidate media unless the user explicitly asks to inspect a named directory.
- Do not select or upload unrelated files found in temporary folders, caches, prior outputs, project archives, chat attachments from other tasks, or nearby directories.
- Do not reuse a previously supplied asset in a later deployment unless the user explicitly identifies it again.
- Do not follow links or download adjacent resources beyond the exact user-provided URL unless the user explicitly authorizes that broader scope.

## Missing material

If the exact authorized item is missing, unreadable, or unsuitable, stop and ask the user to upload it again or provide a replacement. Do not substitute another local asset automatically.

