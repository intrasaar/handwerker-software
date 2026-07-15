<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>intrasaar media — Software</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    .logo-bar { width: 100%; background: white; padding: 0; text-align: center; }
    .logo-bar img { width: 100%; height: 90px; object-fit: contain; display: block; }
    .container { max-width: 600px; width: 90%; margin: 0 auto; padding: 40px 0; }
    h1 { font-size: 20px; margin-bottom: 6px; }
    .subtitle { color: #64748b; font-size: 13px; margin-bottom: 28px; }
    .folder { display: block; background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px 20px; margin-bottom: 10px; text-decoration: none; color: #e2e8f0; transition: all 0.15s; }
    .folder:hover { border-color: #3b82f6; background: #1e3a5f; transform: translateX(4px); }
    .folder-name { font-weight: 600; font-size: 16px; }
    .folder-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
    .empty { color: #475569; font-size: 14px; text-align: center; padding: 40px 0; }
    .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="logo-bar">
    <img src="intrasaar_logo.jpg" alt="intrasaar media">
  </div>
  <div class="container">

    <?php
    $dirs = array_filter(glob(__DIR__ . '/*'), 'is_dir');
    $excludes = ['.', '..', '.htaccess'];

    if (empty($dirs)) {
      echo '<div class="empty">Keine Software-Releases vorhanden.</div>';
    } else {
      rsort($dirs);
      foreach ($dirs as $dir) {
        $name = basename($dir);
        if (in_array($name, $excludes)) continue;
        $files = count(glob("$dir/*"));
        $date = date('d.m.Y', filemtime($dir));
        echo "<a class=\"folder\" href=\"$name/\">";
        echo "<div class=\"folder-name\">$name</div>";
        echo "<div class=\"folder-meta\">$files Dateien · Stand: $date</div>";
        echo "</a>";
      }
    }
    ?>

    <div class="footer">&copy; <?= date('Y') ?> intrasaar media</div>
  </div>
</body>
</html>
