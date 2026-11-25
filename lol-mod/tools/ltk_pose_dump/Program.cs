using System;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Collections.Generic;
using LeagueToolkit.Core.Animation;
// dump.dll <anm dir> <out dir> <fps>: per clip a binary file with every frame's local TRS per track
var fps = float.Parse(args[2], System.Globalization.CultureInfo.InvariantCulture);
Directory.CreateDirectory(args[1]);
foreach (var f in Directory.GetFiles(args[0], "*.anm"))
{
    var a = AnimationAsset.Load(new MemoryStream(File.ReadAllBytes(f)));
    int n = Math.Max(1, (int)Math.Floor(a.Duration * fps + 1e-3) + 1);
    var pose = new Dictionary<uint, (Quaternion, Vector3, Vector3)>();
    a.Evaluate(0, pose);
    var hashes = pose.Keys.OrderBy(h => h).ToArray();
    using var w = new BinaryWriter(File.Create(Path.Combine(args[1], Path.GetFileNameWithoutExtension(f) + ".pose")));
    w.Write(n); w.Write(hashes.Length); w.Write(a.Duration);
    foreach (var h in hashes) w.Write(h);
    for (int k = 0; k < n; k++)
    {
        float t = Math.Min(k / fps, a.Duration);
        pose.Clear(); a.Evaluate(t, pose);
        foreach (var h in hashes)
        {
            var (q, tr, sc) = pose.TryGetValue(h, out var v) ? v : (Quaternion.Identity, Vector3.Zero, Vector3.One);
            w.Write(q.X); w.Write(q.Y); w.Write(q.Z); w.Write(q.W);
            w.Write(tr.X); w.Write(tr.Y); w.Write(tr.Z); w.Write(sc.X); w.Write(sc.Y); w.Write(sc.Z);
        }
    }
}
Console.WriteLine("dumped");
