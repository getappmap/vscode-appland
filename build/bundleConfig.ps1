#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$true)]
    [string]$VsixPath,

    [Parameter(Mandatory=$true)]
    [string]$SiteConfigPath,

    [Parameter(Mandatory=$false)]
    [string]$PlatformIdentifier,

    [Parameter(Mandatory=$false)]
    [string[]]$Binaries
)

# --- Hardcoded tool information ---
$ToolsOwner = 'getappmap'
$ToolsRepo = 'appmap-js'
$ToolsToDownload = @('appmap', 'scanner')
# --------------------------------

# Initialize Binaries as an empty array if not provided
if (-not $Binaries) {
    $Binaries = @()
}

# Split $Binaries into an array if it's a single string with spaces or commas
if ($Binaries.Count -eq 1) {
    $Binaries = $Binaries[0] -split '[\s,]+'
}

function Get-NpmLatestVersion($packageName) {
    try {
        Write-Host "Fetching the latest version for $packageName from npm registry API..."
        $encodedName = [System.Web.HttpUtility]::UrlEncode($packageName)
        $url = "https://registry.npmjs.org/$encodedName"
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing
        $json = $response.Content | ConvertFrom-Json
        $version = $json."dist-tags".latest
        Write-Host "Latest version for $packageName is $version"
        return $version
    } catch {
        Write-Error "Failed to get latest version for $packageName from npm registry API. Error: $_"
        return $null
    }
}

function Download-File($url, $path) {
    if (Test-Path $path) {
        Write-Host "File $path already exists. Skipping download."
        return $true
    }
    try {
        Write-Host "Downloading from $url to $path..."
        Invoke-WebRequest -Uri $url -OutFile $path
        Write-Host "Download complete."
        return $true
    } catch {
        Write-Error "Failed to download file from $url. Error: $_"
        return $false
    }
}

if ($PlatformIdentifier) {
    Write-Host "Platform identifier provided: $PlatformIdentifier. Preparing to download tools."
    foreach ($tool in $ToolsToDownload) {
        $tool = $tool.Trim()
        $latestVersion = Get-NpmLatestVersion -packageName "@appland/$tool"
        if ($latestVersion) {
            $os, $arch = $PlatformIdentifier.Split('-')
            $binaryExtension = if ($os -eq 'win') { ".exe" } else { "" }
            $fileName = "${tool}-${os}-${arch}-${latestVersion}${binaryExtension}"
            $downloadPath = Join-Path (Get-Location) $fileName

            $artifactName = "@appland/${tool}-v${latestVersion}/${tool}-${PlatformIdentifier}${binaryExtension}"
            $url = "https://github.com/$ToolsOwner/$ToolsRepo/releases/download/$artifactName"
            
            if (Download-File -url $url -path $downloadPath) {
                $Binaries += $downloadPath
            }
        }
    }
}

try {
    # 1. Create a temporary directory for extraction
    if ($env:TEMP) {
        $baseTemp = $env:TEMP
    } elseif ($env:TMP) {
        $baseTemp = $env:TMP
    } else {
        $baseTemp = "/tmp"
    }
    $tempDir = Join-Path $baseTemp ([System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    Write-Host "Extracting VSIX package $VsixPath to a temporary directory..."
    # 2. Extract the VSIX
    Expand-Archive -Path $VsixPath -DestinationPath $tempDir

    $packageJsonPath = Join-Path $tempDir "extension/package.json"
    if (-not (Test-Path $packageJsonPath)) {
        throw "Error: package.json not found in VSIX"
    }

    $packageJsonContent = Get-Content -Path $packageJsonPath -Raw
    $packageJson = $packageJsonContent | ConvertFrom-Json

    Write-Host "Reading site configuration from $SiteConfigPath..."
    $siteConfigContent = Get-Content -Path $SiteConfigPath -Raw
    if (-not $siteConfigContent) {
        throw "Error: site-config.json not found or empty"
    }
    $siteConfig = $siteConfigContent | ConvertFrom-Json -AsHashtable

    # 3. Backup original package.json and update it
    Write-Host "Updating package.json with site configuration..."
    Copy-Item -Path $packageJsonPath -Destination (Join-Path $tempDir "extension/package.json.orig")

    if (-not $packageJson.contributes) {
        $packageJson | Add-Member -MemberType NoteProperty -Name "contributes" -Value ([pscustomobject]@{configuration = [pscustomobject]@{properties = [pscustomobject]@{}}})
    } elseif (-not $packageJson.contributes.configuration) {
        $packageJson.contributes | Add-Member -MemberType NoteProperty -Name "configuration" -Value ([pscustomobject]@{properties = [pscustomobject]@{}})
    }

    $configProperties = $packageJson.contributes.configuration.properties

    function Get-JsonSchemaType($val) {
        if ($null -eq $val) { return 'null' }
        $typeName = $val.GetType().Name
        switch ($typeName) {
            'String' { return 'string' }
            'Int32' { return 'integer' }
            'Int64' { return 'integer' }
            'Double' { return 'number' }
            'Single' { return 'number' }
            'Boolean' { return 'boolean' }
            'Hashtable' { return 'object' }
            'OrderedHashtable' { return 'object' }
            'Object[]' { return 'array' }
            'ArrayList' { return 'array' }
            default { return 'string' }
        }
    }

    foreach ($key in $siteConfig.Keys) {
        $value = $siteConfig[$key]
        Write-Host "Setting $key to $($value | ConvertTo-Json -Compress)"

        if ($configProperties.PSObject.Properties[$key]) {
            $configProperties.$key.default = $value
        } else {
            $newProperty = [pscustomobject]@{
                type = Get-JsonSchemaType $value
                default = $value
                markdownDescription = ""
            }
            $configProperties | Add-Member -MemberType NoteProperty -Name $key -Value $newProperty
        }
    }

    # 4. Add site-config.json to the VSIX folder for reference
    Write-Host "Adding site-config.json to the VSIX package..."
    Copy-Item -Path $SiteConfigPath -Destination (Join-Path $tempDir "extension/site-config.json")

    $resourcesDir = Join-Path $tempDir "extension/resources"
    if (-not (Test-Path $resourcesDir)) {
        New-Item -ItemType Directory -Path $resourcesDir | Out-Null
    }

    # 4a. Add binaries to /extension/resources if provided
    if ($Binaries -and $Binaries.Count -gt 0) {
        Write-Host "Adding binaries to the VSIX package..."
        foreach ($bin in $Binaries) {
            $bin = $bin.Trim()
            if (Test-Path $bin) {
                $binFilename = Split-Path -leaf $bin
                Write-Host "- Adding $binFilename to /extension/resources"
                Copy-Item -Path $bin -Destination $resourcesDir -Force
                if ($IsLinux -or $IsMacOS) {
                    Write-Host "  - Setting executable permissions for $binFilename"
                    $destPath = Join-Path $resourcesDir $binFilename
                    chmod +x $destPath
                }
            } else {
                Write-Warning "Binary not found: $bin"
            }
        }
    }

    # 5. Write the updated package.json
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath

    # 6. Repack the VSIX
    $outputVsixPath = $VsixPath.Replace(".vsix", "-mod.vsix")
    if (Test-Path $outputVsixPath) {
        Remove-Item $outputVsixPath
    }
    Write-Host "Repacking the VSIX package to $outputVsixPath..."
    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $outputVsixPath

    Write-Host "Successfully modified VSIX. New file is at: $outputVsixPath"

} finally {
    # 7. Clean up the temporary directory
    if ($tempDir -and (Test-Path $tempDir)) {
        Write-Host "Cleaning up temporary files..."
        Remove-Item -Recurse -Force -Path $tempDir
    }
}
