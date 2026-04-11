async function send(){

    let f = document.getElementById("file").files[0]

    let form = new FormData()
    form.append("file", f)
    form.append("lat", document.getElementById("lat").value)
    form.append("lon", document.getElementById("lon").value)

    let res = await fetch("/api/analyze", {
        method:"POST",
        body: form
    })

    let d = await res.json()

    document.getElementById("out").innerText =
        JSON.stringify(d, null, 2)
}
