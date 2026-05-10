$port = 8000
Write-Host "Iniciando servidor local em http://localhost:$port"

try {
    python -m http.server $port
} catch {
    try {
        py -3 -m http.server $port
    } catch {
        try {
            python3 -m http.server $port
        } catch {
            Write-Error "Nenhum interpretador Python encontrado. Instale o Python ou execute manualmente."
            exit 1
        }
    }
}
