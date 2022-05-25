const cam_selector = document.getElementById("cam_selector");
const cam_viewer = document.getElementById("camera");
const pfcvs = fx.canvas();
let canvas_img = document.createElement("canvas");
let stream;
let shaped_uri;
let height;
let click = false;

let points = [{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9}];
let out_points = [{x:0.05,y:0.2},{x:0.95,y:0.2},{x:0.95,y:0.8},{x:0.05,y:0.8}];
document.getElementById("update").addEventListener("click",get_camera);
document.getElementById("shutter").addEventListener("click",trim);
document.getElementById("upload").addEventListener("click",() => {trim(true)});

(async () => {
    await get_camera();

    await set_camera();
    cam_selector.addEventListener("change",set_camera);
    let is = document.getElementById("img_selector");
    is.addEventListener("change",() => {
        let img = document.getElementById("preview_img");
        if(is.files.length > 0){
            let reader = new FileReader();
            reader.onload = function (e) {
                img.src = e.target.result;
                img.onload = () => {
                    if(img.width > 1000){
                        img.width = 1000;
                        height = img.height;
                    }
                };
            }
            reader.readAsDataURL(is.files[0]);
            document.getElementById("upload").disabled = false;
        }else{
            img.src = "";
            document.getElementById("upload").disabled = true;
        }
    });
})();

async function set_camera() {
    if(cam_selector.value){
        cam_viewer.hidden = false;
        document.getElementById("cam_disable").hidden = true;
        document.getElementById("shutter").disabled = false;
        stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{ deviceId: cam_selector.value }});
        cam_viewer.srcObject = stream;
    }else{
        cam_viewer.hidden = true;
        document.getElementById("cam_disable").hidden = false;
        document.getElementById("shutter").disabled = true;
    }
}

async function get_camera() {
    let devices = await navigator.mediaDevices.enumerateDevices();
    for(let media of devices){
        if(media.kind == "videoinput"){
            let cam_el = document.createElement("option");
            cam_el.value = media.deviceId;
            cam_el.textContent = media.label;
            cam_selector.appendChild(cam_el);
        }
    }
}

function trim(file=false){
    document.getElementById("cam_area").hidden = true;
    document.getElementById("trim_area").hidden = false;
    //ビデオ映像を切り取り
    document.getElementById("state_area").innerHTML = "漢字の部分を切り取ってください。<br>※できるだけ正確に合わしてください。";
    let canvas = document.getElementById("preview");
    let center = document.getElementById("center");
    let setting;
    if(file){
        let img = document.getElementById("preview_img");
        setting = {
            width: img.width,
            height: height
        };
    }else{
        setting = stream.getVideoTracks()[0].getSettings();
    }
    canvas.width = setting.width;
    canvas.height = setting.height;
    canvas_img.width = setting.width;
    canvas_img.height = setting.height;
    let ctx = canvas.getContext("2d");
    let cctx = center.getContext("2d");
    if(file){
        canvas_img.getContext("2d").drawImage(document.getElementById("preview_img"),0,0,setting.width,setting.height);
    }else{
        canvas_img.getContext("2d").drawImage(cam_viewer,0,0);
    }
    //線を描画
    draw_line(ctx,points,canvas.width,canvas.height);

    window.addEventListener('mousedown',(e) => {
        click = true;
    });
    window.addEventListener('mouseup',(e) => {
        click = false;
    });
    canvas.addEventListener('mousemove', (e) => {
        if(click){
            let rect = e.target.getBoundingClientRect();
            x = (e.clientX - rect.left)/500;
            y = (e.clientY - rect.top)/(canvas.height/canvas.width * 500);
            let best_distance = 10000;
            let index;
            for(let [i,point] of points.entries()){
                let distance = Math.sqrt(Math.pow(x-point.x, 2)+Math.pow(y-point.y, 2));
                if(distance < best_distance){
                    best_distance = distance;
                    index = i;
                }
            }
            if(best_distance < 0.2){
                points[index] = {x:x,y:y};
                draw_line(ctx,points,canvas.width,canvas.height);
                cctx.clearRect(0,0,100,100);
                cctx.drawImage(canvas_img,(x-0.025)*canvas.width,(y-0.025)*canvas.height,canvas.width/20,canvas.height/20,0,0,100,100);
                cctx.strokeStyle = "black";
                cctx.beginPath();
                cctx.moveTo(50, 0);
                cctx.lineTo(50, 100);
                cctx.moveTo(0, 50);
                cctx.lineTo(100, 50);
                cctx.stroke();
            
            }
        }
    });
    document.getElementById("trim").addEventListener("click",() => {
        shape(canvas.width,canvas.height);
    });
}

function shape(w,h){
    document.getElementById("state_area").innerHTML = "サイズを整えてください。<br>※できるだけ漢字のサイズが1:1になるようにしてください。";
    document.getElementById("trim_area").hidden = true;
    document.getElementById("shape_area").hidden = false;
    let preview = document.getElementById("reshaped");
    let img = new Image();
    img.src = canvas_img.toDataURL("image/png");
    img.addEventListener("load",() => {
        let texture = pfcvs.texture(img);
        let from = [
            w*points[0].x,h*points[0].y,
            w*points[1].x,h*points[1].y,
            w*points[3].x,h*points[3].y,
            w*points[2].x,h*points[2].y
        ];
        let to = [
            w*out_points[0].x,h*out_points[0].y,
            w*out_points[1].x,h*out_points[1].y,
            w*out_points[3].x,h*out_points[3].y,
            w*out_points[2].x,h*out_points[2].y
        ];
        pfcvs.draw(texture).perspective(from,to).update();
        shaped_uri = pfcvs.toDataURL("image/png");

        preview.width = w;
        preview.height = h;
        let pctx = preview.getContext("2d");

        draw_line(pctx,out_points,w,h,shaped_uri);

        preview.addEventListener('mousemove', (e) => {
            if(click){
                let rect = e.target.getBoundingClientRect();
                x = (e.clientX - rect.left)/500;
                y = (e.clientY - rect.top)/(preview.height/preview.width * 500);
                let best_distance = 10000;
                let index;
                for(let [i,point] of out_points.entries()){
                    let distance = Math.sqrt(Math.pow(x-point.x, 2)+Math.pow(y-point.y, 2));
                    if(distance < best_distance){
                        best_distance = distance;
                        index = i;
                    }
                }
                if(best_distance < 0.2){
                    switch(index){
                        case 0:
                            out_points[0] = {x:x,y:y};
                            out_points[1].y = y;
                            out_points[3].x = x;
                            break;
                        case 1:
                            out_points[1] = {x:x,y:y};
                            out_points[0].y = y;
                            out_points[2].x = x;
                            break;
                        case 2:
                            out_points[2] = {x:x,y:y};
                            out_points[3].y = y;
                            out_points[1].x = x;
                            break;
                        case 3:
                            out_points[3] = {x:x,y:y};
                            out_points[2].y = y;
                            out_points[0].x = x;
                            break;
                    }
                    draw_line(pctx,out_points,w,h,shaped_uri);
                }
            }
        });
    });
    document.getElementById("resize").addEventListener("click",() => {
        let rimg = new Image();
        rimg.src = shaped_uri;
        let ctx = preview.getContext("2d");
        rimg.addEventListener("load",() => {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(
                rimg,
                out_points[0].x*w - (out_points[1].x - out_points[0].x)/0.9*w*0.05,
                out_points[0].y*h - (out_points[3].y - out_points[0].y)/0.6*h*0.2, // h*y0-(y3-y0)/0.4*h*0.3
                (out_points[1].x - out_points[0].x)/0.9*w,
                (out_points[3].y - out_points[0].y)/0.6*h
            );
            binarization(127);
        });
        option();
    });
}

function option(){
    document.getElementById("state_area").innerHTML = "設定してください。";
    document.getElementById("shape_area").hidden = true;
    document.getElementById("option_area").hidden = false;
    document.getElementById("specify").addEventListener("click",() => {
        document.getElementById("idiom_characters").disabled = !document.getElementById("specify").checked;
    });
    document.getElementById("run").addEventListener("click",judgement);
    document.getElementById("threshold").oninput = () => {
        binarization(document.getElementById("threshold").value);
    };
}

function binarization(threshold){
    let canvas = document.getElementById("binarization");
    let preview = document.getElementById("reshaped");
    let ctx = canvas.getContext("2d");
    canvas.width = (out_points[1].x - out_points[0].x) * canvas_img.width;
    canvas.height = (out_points[3].y - out_points[0].y) * canvas_img.height;
    ctx.drawImage(
        preview,
        out_points[0].x*canvas_img.width,
        out_points[0].y*canvas_img.height,
        canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height
    );
    let src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let dst = ctx.createImageData(canvas.width, canvas.height);

    for (var i = 0; i < src.data.length; i += 4) {
        let y = ~~(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]);
        let ret = (y > threshold) ? 255 : y;
        dst.data[i] = dst.data[i+1] = dst.data[i+2] = ret;
        dst.data[i+3] = src.data[i+3];
    }
    ctx.putImageData(dst, 0, 0);
}

async function judgement(){
    document.getElementById("state_area").innerHTML = "判定中...";
    document.getElementById("option_area").hidden = true;
    document.getElementById("output_area").hidden = false;
    let characters = document.getElementById("characters").value;
    let table = document.getElementById("output");
    let preview = document.getElementById("reshaped");
    let bin_preview = document.getElementById("binarization");
    let char_gets = 0;

    //常用漢字ファイル取得
    let jyoyo;
    let req = new XMLHttpRequest();
    req.open("get", "data/jyoyo.txt", true);
	req.send();
    req.onload = () => {
        jyoyo = req.responseText.split("");
    }

    let model = await tf.loadLayersModel("./model/tfjs_model_2/model.json")
    for(let i = 0;i<characters;i++){
        //写真
        let index_td = document.createElement("td");
        index_td.textContent = i+1;
        table.children[0].children[0].appendChild(index_td);
        let trim_cvs = document.createElement("canvas");
        let character_width = (out_points[1].x - out_points[0].x) * canvas_img.width / characters;
        trim_cvs.width = character_width;
        trim_cvs.height = (out_points[3].y - out_points[0].y) * canvas_img.height;
        let trim_ctx = trim_cvs.getContext("2d");
        trim_ctx.drawImage(
            preview,
            out_points[0].x*canvas_img.width+character_width*i,
            out_points[0].y*canvas_img.height,
            character_width, trim_cvs.height,
            0, 0, trim_cvs.width, trim_cvs.height
        );

        //画像
        let img_cvs = document.createElement("canvas");
        img_cvs.width = character_width;
        img_cvs.height = trim_cvs.height;
        let img_ctx = img_cvs.getContext("2d");
        img_ctx.drawImage(
            bin_preview,
            character_width*i,
            0,
            character_width, img_cvs.height,
            0, 0, img_cvs.width, img_cvs.height
        );

        //表示
        let char_td = document.createElement("td");//番号
        char_td.id = `char_${i}`;
        table.children[0].children[3].appendChild(char_td);
        let pic = document.createElement("img");//写真
        pic.src = trim_cvs.toDataURL("image/png");
        let pic_td = document.createElement("td");
        pic_td.appendChild(pic);
        table.children[0].children[1].appendChild(pic_td);
        let img = document.createElement("img");//画像
        img.src = img_cvs.toDataURL("image/png");
        img.width = 64;
        img.height = 64;
        let img_td = document.createElement("td");
        img_td.appendChild(img);
        table.children[0].children[2].appendChild(img_td);
        let j = i;
        //文字認識
        img.onload = () => {
            let data = tf.browser.fromPixels(img, 1).reshape([1, 64, 64, 1]).div(tf.scalar(-255)).add(tf.scalar(1));
            let result = model.predict(data);

            let td = document.getElementById(`char_${j}`);
            let in_el = document.createElement("input");
            in_el.type = "text";
            in_el.value = jyoyo[result.reshape([-1]).argMax().arraySync()];
            in_el.className = "result_input";
            td.appendChild(in_el);
            char_gets++;
            if(char_gets == characters){
                document.getElementById("state_area").innerHTML = '判定を完了しました。誤判定があった場合は訂正してから「検索」ボタンを押してください。<button id="search">検索</button>';
                document.getElementById("search").onclick = search;
            }
        }
    }
}

function search(){
    let characters = document.getElementById("characters").value;
    let words = document.getElementById("words").value;
    let table = document.getElementById("output");
    let sp = document.getElementById("specify").checked;
    let length = document.getElementById("idiom_characters").value;
    let req = new XMLHttpRequest();
    req.open("get", `data/${document.getElementById("priority_selector").value}_jyukugo.txt`, true);
	req.send();
    req.onload = () => {
        let jyukugo = req.responseText.split("\r\n");
        //熟語検索
        for(let i = 0;i<characters;i++){
            let char_td = document.getElementById(`char_${i}`);
            char_td.textContent = char_td.children[0].value.charAt(0);
            char_td.style["font-size"] = "20px";
            let index = 0;
            for(let j = 0;j<words;j++){
                if(index < jyukugo.length){
                    if(sp){
                        for(;!(~jyukugo[index].indexOf(char_td.textContent) && jyukugo[index].length == length);index++){
                            if(index+1 >= jyukugo.length){
                                break;
                            }
                        }
                    }else{
                        for(;!~jyukugo[index].indexOf(char_td.textContent);index++){
                            if(index+1 >= jyukugo.length){
                                break;
                            }
                        }
                    }
                }
                if(index+1 >= jyukugo.length){
                    let td = document.createElement("td");
                    td.textContent = "なし";
                    td.style.color = "red";
                    table.children[0].children[j+4].appendChild(td);
                }else{
                    let td = document.createElement("td");
                    td.textContent = jyukugo[index];
                    table.children[0].children[j+4].appendChild(td);
                }
                index++;
            }
        }
        document.getElementById("state_area").innerHTML = '検索を完了しました。<br>※数が足りない場合や、熟語が気に入らない場合は、<a href="https://kanji.reader.bz/jukugo_2moji/" target="_blank">二字熟語一覧🔗</a>などを利用してください。';
    }
    
    //行追加
    for(let i = 0;i<words;i++){
        let tr = document.createElement("tr");
        let th = document.createElement("th");
        th.textContent = `${i+1}`;
        tr.appendChild(th);
        table.children[0].appendChild(tr);
    }
}

function draw_line(ctx,points,w,h,data_url=false){
    //from
    if(data_url){
        let rimg= new Image();
        rimg.src = data_url;
        rimg.addEventListener("load",() => {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(
                rimg,
                points[0].x*w - (points[1].x - points[0].x)/0.9*w*0.05,
                points[0].y*h - (points[3].y - points[0].y)/0.6*h*0.2, // h*y0-(y3-y0)/0.4*h*0.3
                (points[1].x - points[0].x)/0.9*w,
                (points[3].y - points[0].y)/0.6*h
            );
            ctx.strokeStyle = "red";
            for(let point of points){
                ctx.beginPath();
                ctx.arc(w * point.x, h * point.y, w/50, 0, 2 * Math.PI);
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(w * points[3].x,h * points[3].y);
            for(let point of points){
                ctx.lineTo(w * point.x,h * point.y);
            }
            ctx.stroke();
        });
    }else{
        ctx.drawImage(canvas_img,0,0);
        ctx.strokeStyle = "red";
        for(let point of points){
            ctx.beginPath();
            ctx.arc(w * point.x, h * point.y, w/50, 0, 2 * Math.PI);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(w * points[3].x,h * points[3].y);
        for(let point of points){
            ctx.lineTo(w * point.x,h * point.y);
        }
        ctx.stroke();
    }
}