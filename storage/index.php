<?php
// Guard: never serve directory contents even if .htaccess is ignored.
http_response_code(403);
exit('Forbidden');
