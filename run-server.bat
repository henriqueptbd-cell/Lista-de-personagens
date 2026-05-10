@echo off
setlocal
set PORT=8000
echo Iniciando servidor local em http://localhost:%PORT%

python -m http.server %PORT% 2>nul || py -3 -m http.server %PORT% 2>nul || python3 -m http.server %PORT% 2>nul || (
    echo.
    echo Erro: nenhum interpretador Python encontrado.
    echo Instale o Python ou use um servidor HTTP alternativo.
    echo Você pode usar: npx http-server . -p %PORT%
    exit /b 1
)
